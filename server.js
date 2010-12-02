var ArgsParser, Chain, Config, Fs, Http, Mongrel2, Postmark, Query, Readability, Request, Spawn, Sys, Url, args, fourOhFour, identity, job, recv, send;
require('joose');
require('joosex-namespace-depended');
require('hash');
ArgsParser = require('argsparser');
Url = require('url');
Fs = require('fs');
Http = require('http');
Query = require('querystring');
Sys = require('sys');
Readability = require('./readability/lib/readability');
Spawn = require('child_process').spawn;
Request = require('request');
Config = JSON.parse(Fs.readFileSync('config.json', 'utf8'));
Mongrel2 = require('mongrel2');
Postmark = 'http://api.postmarkapp.com/email';
Chain = require('./chain-gang').create();
args = ArgsParser.parse();
fourOhFour = function(reply) {
  return reply(404, {
    'Content-Type': 'text/javascript'
  }, "alert('You fail...');");
};
job = function(url) {
  return function(worker) {
    return Request({
      uri: url
    }, function(error, response, body) {
      if (typeof error !== "undefined" && error !== null) {
        return worker.finish();
      } else {
        try {
          return Readability.parse(body, url, function(result) {
            var filename;
            filename = Hash.sha1(url);
            return Fs.writeFile("" + (filename) + ".html", result.content, function(err) {
              var wkhtmltopdf;
              if (typeof err !== "undefined" && err !== null) {
                Sys.puts('failed writing HTML file');
                return worker.finish();
              } else {
                wkhtmltopdf = Spawn('wkhtmltopdf', ['--page-size', 'letter', '--encoding', 'utf-8', ("" + (filename) + ".html"), ("" + (filename) + ".pdf")]);
                return wkhtmltopdf.on('exit', function(code) {
                  if (0 === code) {
                    return Fs.readFile("" + (filename) + ".pdf", 'base64', function(err, data) {
                      if (typeof err !== "undefined" && err !== null) {
                        Sys.puts("error reading file");
                        return worker.finish();
                      } else {
                        Sys.puts('sending to postmark');
                        return Request({
                          uri: Postmark,
                          method: 'POST',
                          body: JSON.stringify({
                            From: Config.email.from,
                            To: Config.email.to,
                            Subject: 'convert',
                            TextBody: 'Straight to your Kindle!',
                            Attachments: [
                              {
                                Name: ("" + (result.title) + ".pdf"),
                                Content: data,
                                ContentType: 'application/pdf'
                              }
                            ]
                          }),
                          headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-Postmark-Server-Token': Config.postmark
                          }
                        }, function(error, response, body) {
                          if (typeof error !== "undefined" && error !== null) {
                            Sys.puts('there was an error...');
                          }
                          switch (response.statusCode) {
                            case 401:
                              Sys.puts('Incorrect API key');
                              break;
                            case 422:
                              Sys.puts('Malformed request');
                              break;
                            case 200:
                              Sys.puts('Everything went smoothly');
                              break;
                            default:
                              Sys.puts('Some other stupid problem');
                          }
                          Fs.unlink("" + (filename) + ".pdf");
                          Fs.unlink("" + (filename) + ".html");
                          return worker.finish();
                        });
                      }
                    });
                  } else {
                    Sys.puts("wkhtmltopdf exited with code " + (code));
                    return worker.finish();
                  }
                });
              }
            });
          });
        } catch (e) {
          Sys.puts("caught an error: " + (e));
          return worker.finish();
        }
      }
    });
  };
};
recv = args['--recv'] || 'tcp://127.0.0.1:9997';
send = args['--send'] || 'tcp://127.0.0.1:9996';
identity = args['--identity'] || 'kindlebility';
Mongrel2.connect(recv, send, identity, function(msg, reply) {
  var _ref, query, url;
  url = Url.parse(msg.path);
  if (typeof (_ref = url.query) !== "undefined" && _ref !== null) {
    query = Query.parse(url.query);
    if (typeof (_ref = query.u) !== "undefined" && _ref !== null) {
      if (query.key === Config.key) {
        url = query.u;
        Chain.add(job(url));
        return reply(200, {
          'Content-Type': 'text/javascript'
        }, "alert('All good boss!');");
      } else {
        return reply(403, {
          'Content-Type': 'text/javascript'
        }, "alert('Not authorized');");
      }
    } else {
      return reply(400, {
        'Content-Type': 'text/javascript'
      }, "alert('No URL present');");
    }
  } else {
    return reply(412, {
      'Content-Type': 'text/javascript'
    }, "alert('Missing parameters');");
  }
});