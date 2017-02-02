var request = require('request');
var fs = require('fs');
var cheerio = require('cheerio');
var pb = require('pushbullet');
var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var port = process.env.PORT || 8080;
var router = express.Router();
var mysql = require("mysql");
var amzn_domain_url= "http://www.amazon.com/dp/";


// First you need to create a connection to the db
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "ptnew"
});

triggerPriceTracker();
var prevPrices={};
var urldetails= [];
function triggerPriceTracker(){

				var urlsquery = 'SELECT * FROM userurldetails';
                con.query(urlsquery, function(err, rows) {
                    if (err) {
                        console.log("error in starting trigger point");
                        console.log(err);
                    } else {
						 urldetails= [];
						 console.log("length " + rows.length);
						for(var k=0; k <rows.length;k++){
							var asin = rows[k].asin;
							var userid= rows[k].userid;
							var url= rows[k].url;
							var asinuser ={};
							asinuser["asin"] = asin;
							asinuser["userdbid"] = userid;
							asinuser["url"] = url;
							urldetails.push(asinuser);

						}

						for(var l=0; l <urldetails.length;l++){

							var amzn_url = "http://www.amazon.com/dp/"+urldetails[l].asin;

							request(amzn_url, function (error, response, body) {
							fs.writeFile('product.html', body, function(error) {

							-
							request (amzn_url, function (error, response, body) {


							var $ = cheerio.load(body);
							console.log("cheerio", $);
							var list_price = $('#priceblock_ourprice').text();
							var item_name = $("#productTitle").text();
							console.log("Product name ", item_name);

							var stripped_price = + list_price.replace('$', '').replace(',', '');
							console.log('PRICE:', stripped_price);


							if(!prevPrices[asin]){
								prevPrices[asin] = 0;
							}

							if (stripped_price <= prevPrices[asin]){
							  notify (item_name, "down", stripped_price, prevPrices[asin], getUseridbyurl(amzn_url));
							}

							else if (stripped_price >= prevPrices[asin]) {
							  notify (item_name, "up", stripped_price, prevPrices[asin], getUseridbyurl(amzn_url));
							}

							prevPrices[asin] = stripped_price;



						  });

							// setTimeout(triggerPriceTracker, 60000);

						  });

						  });
						}
                    }
                })
}

function getUseridbyurl(amzn_url) {
	var asin  = amzn_url.split("/").pop().trim();

	for(var i=0; i < urldetails.length; i++){
		if(urldetails[i].url.indexOf(asin)>0){
			return urldetails[i].userdbid;
		}
	}
}

router.get('/submituser', function(req, res) {
    console.log("saving user ..");
    var username = req.param('userid');
	var pushtoken = req.param('pushtoken');
    con.query('SELECT * FROM user where userid="' + username + '"', function(err, rows) {
        if (err) {
            res.json({
                message: 'false',
                data: rows
            });
        } else {
            console.log('Data received from Db:\n');
            console.log(rows);
            if (rows.length > 0) {
                res.json({
                    message: 'true',
                    data: rows[0].id
                });
            } else {
				var queryurl = 'INSERT into user ( userid,pushtoken) VALUES ("' + username + '","' + pushtoken +'")';
				console.log("$$$$$$$$" + queryurl);
                con.query(queryurl, function(err, rows) {
                    if (err) {
                        res.json({
                            message: 'false',
                            data: err
                        });
                    } else {
                        res.json({
                            message: 'true',
                            userid: rows.insertId
                        });
                    }
                })
            }
        }

    });
});



router.get('/geturls', function(req, res) {
    console.log("geturls..");
    var uid = req.param('userid');
    con.query('SELECT * FROM userurldetails where userid="' + uid + '"', function(err, rows) {
        if (err) {
            res.json({
                message: 'false'
            });
        } else {
            console.log('Urls received from Db:\n');

                res.json({
                    message: 'true',
                    data: rows
                });
        }

    });
});






router.get('/delete', function(req, res) {
    console.log("delete url ..");
    var uid = req.param('urlid');
    con.query('DELETE FROM userurldetails where id='+uid, function(err, rows) {
        if (err) {
			 console.log('Url deleted err \n', err);
            res.json({
                message: 'false'
            });
        } else {
            console.log('Url deleted from Db:\n');

                res.json({
                    message: 'true',
                    data: rows
                });
        }

    });
});


router.post('/submiturl', function(req, res) {
    console.log("saving url ..");
	var obj = req.body;
	var asin = obj.url.match("/([a-zA-Z0-9]{10})(?:[/?]|$)")[1];
	console.log("obj.url" , obj.url);
	console.log("asin" , asin);
	 if(asin.length >0){
     con.query('INSERT into userurldetails ( url,userid,asin ) VALUES ("' + obj.url + '","' + obj.userid + '","' + asin + '")', function(err, rows) {
                    if (err) {
						console.log("err", err);
                        res.json({
                            message: 'false',
                            data: err
                        });
                    } else {
						// get data
                        res.json({
                            message: 'true',
                            data: rows.insertId
                        });
                    }
                    triggerPriceTracker();
                })
	 }
});


function notify(item, updown, current, prev,userid){
	console.log("inside notify function " + item);
	console.log("vals", updown,current,prev,userid);
  var message = "";
  if (updown == "up" ){
    message = "The item "+ item.trim() +" price went up from $"+ prev + " to $"+ current;
  } else if (updown = "down"){
    message = "The item "+ item.trim() + " price went down from $"+ current + " from $"+ prev;
  } else{
    message = "There is no change in the item price";
  }


  con.query('SELECT * FROM user where id='+ userid, function(err, rows) {
        console.log('Data received from Db:\n');
            console.log(rows);
            if (rows.length > 0) {

  console.log('Sending PUSH! ALERT!');
 // var pushBullet = new pb("o.k7r34pWmIFG2AulIw4r52RnW5SMJ1nN4");

  var pushBullet = new pb(rows[0].pushtoken);
  console.log("push notification message" , message);
  pushBullet.note(null, "Amazon Price Watch", message, null, function (error, response) {

    process.exit()


  });

            }

    });


}

app.use('/pricetracker', router);

app.listen(port);
console.log("Server started.");


// FE: AJAX calls to BE
// BE in Express
// REST request
// jQuery pseudocode


// const updateFreq = 10 * 1000;
// setInterval(getUpdate, updateFreq);

// function getUpdate() {
//   $.ajax({
//       url: '/update',
//       data: { productID: 499, ... }
//       success: function(data) {
//         // on success, do this
//         if (data.updated) {
//           $('#update').append(`<p>Item ${data.productID} updated! Now ${data.newPrice}.</p>`);
//         }
//       }
//   })
// }


// BE to price_tracker communication

// in price_tracker

// ... when update found
// var productID = ...;
// var newPrice = ...;


// { productID: 445, newPrice: 45.44 }
//
// var updateRecord = { productID, newPrice };
// fs.writeFileSync('/data/updates.json', updateRecord);


// in express
// when get request on /update URL

// update = fs.readFileSync('/data/updates.json');
// return update to FE
// this on JSON return




