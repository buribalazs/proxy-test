const http = require('http'),
    url = require('url'),
    httpProxy = require('http-proxy'),
    through = require('through'),
    connect = require('connect');

const proxy = httpProxy.createProxyServer();

let app = connect();

let selects = [
    {
        query: 'div',
        func: node => {
            let s = node.createStream();
            s.pipe(through(data => {
                    s.write(data);
                },
                () => {
                    s.end('<p>APPENDED P TO DIV</p>');
                }));
        }
    }
];


app.use(require('harmon')([], selects));

app.use((req, res) => {
    let queryData = url.parse(req.url, true).query;
    proxy.web(req, res, {
        target: queryData.url || 'http://www.example.com',
        changeOrigin: true,
    });
});

http.createServer(app).listen(3200);