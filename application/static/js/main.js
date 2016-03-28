console.log('js serving');

$(function () {

    Highcharts.setOptions({
        global : {
            useUTC : false
        }
    });

    // Create the chart
    $('#charts').highcharts('StockChart', {
        chart : {
            //animation: false,
        },

        rangeSelector: {
            enabled: false,
            buttons: [
                {
                    count: 1,
                    type: 'minute',
                    text: '1M'
                }, 
                {
                    count: 5,
                    type: 'minute',
                    text: '5M'
                }, 
                {
                    count: 30,
                    type: 'minute',
                    text: '30M'
                }, 
                {
                    type: 'all',
                    text: 'All'
                }
            ],
            inputEnabled: false,
            selected: 0
        },

        title : {
            text : ''
        },

        exporting: {
            enabled: false
        },
        navigator: {
            enabled: false,
            series: {
                type: 'areaspline',
                color: '#2980b9',
                fillOpacity: 0.05,
                dataGrouping: {
                    smoothed: true
                },
                lineWidth: 1,
                marker: {
                    enabled: false
                }
            }
        },

        series : [
        ]
    });

});

function chart(){
    return $('#charts').highcharts();
}

function getSeries(uid){
    return {
        download: chart().series[(uid+1)*2],
        upload: chart().series[(uid+1)*2 +1]
    }
}

function seriesBlueprint(mode){
    var color= mode==='download'?'#2980b9':'#e74c3c';
    return {
        name : mode,
        color: color,
        visible: false,
        type: 'areaspline',
        tooltip: {
            valueSuffix: 'kbps'
        },
        data : []
    }
}


//to get all devices GET /interfaces  :for now I am just using all available interfaces
var defaultInterfaces=['all'];

function getSocketURL(interface_list,mode){
    var host=location.host;    
    var socketURL='ws://'+host+'/websocket/'+interface_list.join('_')+'/'+mode;
    return socketURL;    
}

if ("WebSocket" in window){

    var interfaces=['all'];   
    var rate= new WebSocket(getSocketURL(interfaces,'transfer_rate'));

    var counter=0;
    var seen={};
    var latestLogs=[];
    
    var transfer={
        seen: seen,
        latestLogs: latestLogs,
        activeLog: -1, //-1 if total chart else uid
        window: 0, //0 means all, else form window from minutes back to report_timestamp,
        total_kbps_in: 0,
        total_kbps_out: 0,
        total_mb_in: 0,
        total_mb_out:0
    }
    
    rate.onopen=function(){
        rate.send('start');
        console.log('rate ws starting')
        
        chart().addSeries({
            name : 'Total Download',
            color: '#2980b9',
            type: 'areaspline',
            tooltip: {
                valueSuffix: 'kbps'
            },
            data : []
        });        
        
        chart().addSeries({
            name : 'Total Upload',
            color: '#e74c3c',
            type: 'areaspline',
            tooltip: {
                valueSuffix: 'kbps'
            },
            data : []
        });
    }
    var initMoment= (new Date()).valueOf(); //GLOBAL INIT
    
    rate.onmessage=function(evt){
        
        var report = JSON.parse(evt.data);
        //console.log(report);
        
        function addLogToSeries(entry,uid,timestamp){
            var series= getSeries(uid);
            series.download.addPoint([timestamp,entry['kbps_in']],false,false)
            series.upload.addPoint([timestamp,-1*entry['kbps_out']],false,false)
            
            if(transfer.activeLog===uid){
                var from=latestLogs[uid].initMoment;
                
                if(transfer.window!==0){
                    from= moment().subtract(transfer.window,'minutes').toDate().valueOf();  
                }            
                chart().xAxis[0].setExtremes(from,report.timestamp);                
            }
        }
        
     
          
        chart().series[0].addPoint([report.timestamp,report['total_in']],false,false);        
        chart().series[1].addPoint([report.timestamp,-1*report['total_out']],false,false);
        
        report.entries.forEach(function(entry){
            if(seen[entry.process]===undefined){
                entry.uid=counter;
                seen[entry.process]=counter;
                counter++;
                entry.initMoment= (new Date()).valueOf();
                latestLogs.push(entry);
                
                chart().addSeries(seriesBlueprint('download'));
                chart().addSeries(seriesBlueprint('upload'));
                addLogToSeries(entry,entry.uid,report.timestamp)
                
            }else{
                var uid=seen[entry.process];
                var log=latestLogs[uid];
                log['kbps_in']=entry['kbps_in'];
                log['kbps_out']=entry['kbps_out'];
                addLogToSeries(log,uid,report.timestamp);
            }
        });
        
        if(transfer.activeLog===-1){
            var from=initMoment;
            if(transfer.window!==0){
                from= moment().subtract(transfer.window,'minutes').toDate().valueOf();  
            }            
            chart().xAxis[0].setExtremes(from,report.timestamp);
        }
        
        transfer.total_kbps_in=report.total_in;
        transfer.total_kbps_out=report.total_out;
        rate.send('next');
    }
    rate.onclose=function(){
        console.log('rate ws closed')
    }
    
    /*********************************/
    
    var amount= new WebSocket(getSocketURL(interfaces,'transfer_amount'));
    
    amount.onopen=function(){
        amount.send('start');
        console.log('amount ws starting')
    }
    
    amount.onmessage=function(evt){
        var report=JSON.parse(evt.data);
        //console.log(report);
        
        report.entries.forEach(function(entry){
            if(seen[entry.process]!==undefined){
                var log=latestLogs[seen[entry.process]];
                log['mb_in']=entry['mb_in'];
                log['mb_out']=entry['mb_out'];
            }else{
                //console.log('transfer amount could not be matched',entry)
                //fix this | separate the amount and rate to different views?
            }
        })
        
        transfer.total_mb_in=report.total_in;
        transfer.total_mb_out=report.total_out;
        
        amount.send('next');
    }
    
    amount.onclose=function(){
        console.log('amount ws was closed');
    }
}else{
    // The browser doesn't support WebSocket
    console.error("WebSocket NOT supported by your Browser!");
}

var testData= {
    messages: [
        {
            text: 'ok'
        },
        {
            text: 'not ok'
        }
    ],
    ok: false
};

var test= new Vue({
    el: '#app',
    data: transfer
});

$(".nano").nanoScroller({ alwaysVisible: true });