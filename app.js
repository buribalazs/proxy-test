'use strict';

const http = require('http'),
    url = require('url'),
    zlib = require('zlib'),
    httpProxy = require('http-proxy'),
    through = require('through'),
    cheerio = require('cheerio'),
    connect = require('connect');

const proxy = httpProxy.createProxyServer();

let app = connect();

app.use((req, res, next) => {
    res._write = res.write;
    res._end = res.end;
    res._writeHead = res.writeHead;
    res._chunks = [];
    res._type = '';

    res.writeHead = (...args) => {
        let headers = (args.length > 2) ? args[2] : args[1]; // writeHead supports (statusCode, headers) as well as (statusCode, statusMessage, headers)
        let contentEncoding = res.getHeader('content-encoding');
        let parsedUrl = url.parse(req.url, true);
        res._isHTML = res.getHeader('content-type').includes('text/html');
        res._isJS = res._type.includes('javascript') || parsedUrl.path.split('/').pop().includes('.js');
        console.log(parsedUrl.path.split('/').pop(), res._isJS);
        if (res._isHTML || res._isJS) {
            res.removeHeader('Content-Length');
            res.removeHeader('Location');
            if (contentEncoding && contentEncoding.toLowerCase() === 'gzip') {
                res._isGzipped = true;
                res.removeHeader('Content-Encoding');
                if (headers) {
                    delete headers['content-encoding'];
                }
            }
            setWriters(res);

        }

        res._writeHead.apply(res, args);
    };


    function setWriters(res) {
        if (res._decorated) {
            return;
        }
        res._decorated = true;
        if (res._isHTML) {
            res.write = chunk => {
                chunk && res._chunks.push(chunk);
            };

            res.end = chunk => {
                chunk && res._chunks.push(chunk);
                let buffer = Buffer.concat(res._chunks);
                let data = (res._isGzipped ? zlib.gunzipSync(buffer) : buffer).toString();
                let $ = cheerio.load(data);
                let error = errorPageTransform($.root().html());
                if (error) {
                    $('body').html(error);
                }
                res._write.call(res, $.root().html());
                res._end.call(res);

            }
            ;
        }

        else if (res._isJS) {
            res.write = chunk => {
                console.log(chunk.toString());
                res._write.call(res, chunk);
            };
        }
    }

    next();
})
;

app.use((req, res) => {
    let parsedUrl = url.parse(req.url, true);
    // console.log(parsedUrl);
    proxy.web(req, res, {
        target: 'http://www.superjeweler.com/',
        changeOrigin: true,
    });
});

http.createServer(app).listen(3125);

function errorPageTransform(html) {
    if (html.includes('301 Moved Permanently')) {
        return '<h1>Moved</h1>';
    }
}