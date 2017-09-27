'use strict';

// https://developers.google.com/custom-search/json-api/v1/using_rest
// My panel https://cse.google.com/cse/setup/basic?cx=003896172972665361582:mopzte1vfaw
// example https://cse.google.com/cse/publicurl?cx=003896172972665361582:mopzte1vfaw

// https://www.googleapis.com/customsearch/v1?q=%D0%BA%D0%BE%D1%82%D0%B8%D0%BA%D0%B8&cx=003896172972665361582%3Amopzte1vfaw&key=AIzaSyDJH3csjAQBiVqlRFSFcEfil5Gtvoypxjg

var fs = require('fs');
var express = require('express');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var dbAddress = "mongodb://roicos:atdoijSyicEtEz7@ds155414.mlab.com:55414/image-search";
var db;
var searchEngineURL = "https://www.googleapis.com/customsearch/v1";
var ipKey = "AIzaSyDJH3csjAQBiVqlRFSFcEfil5Gtvoypxjg";
var searchEngineId = "003896172972665361582:mopzte1vfaw";
var resultsLimit = 10;


// creating connection pull
MongoClient.connect(dbAddress, function(err, connection) {  
    if(err){
      console.log("Database connection error: " + err);
    }
    db = connection;
});


if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });

app.use('/api/imagesearch/:query(*)', function(req, res, next) {     
      var queryStr = req.params.query;
      var offset = req.query.offset || 1;
  
      const search = { term: queryStr, when : Date.now()};
      db.collection('latest').insert(search, (err, results) => {
        if (err) { 
          res.end('An error inserting in database has occurred: '+ err ); 
        } else {
          getImages(req, res, queryStr, offset);
        }
      });  
});
    
function getImages(req, res, query, offset){ 
  
  var https = require('https');
  var options = {
    host: "www.googleapis.com",
    path: "/customsearch/v1?q="+ encodeURIComponent(query) +"&cx=" + searchEngineId + "&key="+ipKey + "&fileType=jpg%2C+png%2C+svg&num=" + resultsLimit + "&start=" + offset * resultsLimit
  };
  
  // console.log(options.host + options.path);

  var req = https.get(options, function(data) {
    var bodyChunks = [];
    data.on('data', function(chunk) {
      bodyChunks.push(chunk);
    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      var result = JSON.parse(body);
      var resultJson = [];
      for(var i = 0; i < result.items.length; i++){
        var item = result.items[i];
        
        if(item["pagemap"] == undefined){
          continue;
        } else {
          var resultItem = {};
          if (item["pagemap"]["cse_image"] != undefined){
            resultItem["url"] = item["pagemap"]["cse_image"][0]["src"];
          }
          if (item["pagemap"]["cse_thumbnail"] != undefined){
            resultItem["thumbnail"] = item["pagemap"]["cse_thumbnail"][0]["src"];
          }
          resultItem["snippet"] = item["snippet"]; 
          resultItem["context"] = item["link"]; 
          resultJson.push(resultItem);
        }        
      }
      res.send(resultJson);
    })
  });

  req.on('error', function(e) {
    console.log('ERROR: ' + e.message);
  });
}


app.use('/api/latest/imagesearch/', function(req, res, next) { 
      db.collection('latest').find({}, { _id: false, term: true, when: true }).sort({'when':1}).limit(10).toArray(function(err, result) {
        if (err){
          res.end('An error inserting in database has occurred: '+ err ); 
        } else {
          var resultJson = [];
          for(var i=0; i<result.length; i++){
            var item = {};
            item["term"] = result[i]["term"];
            item["when"] = formatDate(result[i]["when"]);
            resultJson.push(item);
          }
          res.send(resultJson);
        }
      });
});

function formatDate(timestamp){
  var date = new Date(timestamp);
  var year = date.getFullYear();
  var month = date.getMonth()+1;
  var day = date.getDate();
  var hour = date.getHours();
  var min = date.getMinutes();
  var sec = date.getSeconds();

  return year + "-" + 
    (month < 10 ? "0"+month : month) + "-" + 
    (day < 10 ? "0"+day : day) + "T" + 
    (hour < 10 ? "0"+hour : hour) + ":" + 
    (min < 10 ? "0"+min : min) + ":" + 
    (sec < 10 ? "0"+sec : sec);
}

  
app.route('/').get(function(req, res) {
		  res.sendFile(process.cwd() + '/views/index.html');
})

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
})

app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});