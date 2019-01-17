'use strict';

const join = require('url').resolve;
const iconv = require('iconv-lite');
const request = require('request-promise-native');

module.exports = function(options) {
  options || (options = {});
  // const request = coRequest.defaults({ jar: options.jar === true });

  if (!(options.host || options.map || options.url)) {
    throw new Error('miss options');
  }

  return async function proxy(ctx,next) {
    const url = resolve(ctx.path, options);

    if(typeof options.suppressRequestHeaders === 'object'){
      options.suppressRequestHeaders.forEach((h, i) => {
        options.suppressRequestHeaders[i] = h.toLowerCase();
      });
    }

    const suppressResponseHeaders = [];  // We should not be overwriting the options object!
    if(typeof options.suppressResponseHeaders === 'object'){
      options.suppressResponseHeaders.forEach((h, i) => {
        suppressResponseHeaders.push(h.toLowerCase());
      });
    }

    // don't match
    if (!url) {
      return next();
    }

    // if match option supplied, restrict proxy to that match
    if (options.match) {
      if (!ctx.path.match(options.match)) {
        return next();
      }
    }
    
    // const parsedBody = getParsedBody(ctx);

    const opt = {
      url: url + (ctx.querystring ? '?' + ctx.querystring : ''),
      headers: ctx.header,
      encoding: null,
      followRedirect: options.followRedirect !== false,
      method: ctx.method,
      resolveWithFullResponse: true,
      simple:false,
      // body: ctx.request.body,
    };

    // set 'Host' header to options.host (without protocol prefix), strip trailing slash
    if (options.host) opt.headers.host = options.host.slice(options.host.indexOf('://')+3).replace(/\/$/,'');

    // if (options.requestOptions) {
    //   if (typeof options.requestOptions === 'function') {
    //     opt = options.requestOptions(this.request, opt);
    //   } else {
    //     Object.keys(options.requestOptions).forEach(function (option) { opt[option] = options.requestOptions[option]; });
    //   }
    // }

    for(const name in opt.headers){
      if(options.suppressRequestHeaders && options.suppressRequestHeaders.indexOf(name.toLowerCase()) >= 0){
        delete opt.headers[name];
      }
    }

    // const requestThunk = request(opt);
    // console.log(111,res.statusCode);
    const res =await request(opt);
    // if (parsedBody) {
    //   var res =await request(opt);
    // } else {
    //   // Is there a better way?
    //   // https://github.com/leukhin/co-request/issues/11
    //   var res = yield pipeRequest(this.req, requestThunk);
    // }
    // console.log(res.statusCode);
    ctx.status = res.statusCode;
    for (const name in res.headers) {
      // http://stackoverflow.com/questions/35525715/http-get-parse-error-code-hpe-unexpected-content-length
      if(suppressResponseHeaders.indexOf(name.toLowerCase())>=0){
        continue;
      }
      if (name === 'transfer-encoding') {
        continue;
      }
      ctx.set(name, res.headers[name]);
    }

    if (options.encoding === 'gbk') {
      ctx.body = iconv.decode(res.body, 'gbk');
      return;
    }

    ctx.body = res.body;

    if (options.yieldNext) {
      return next()
    }
  };
};


function resolve(path, options) {
  let url = options.url;
  if (url) {
    if (!/^http/.test(url)) {
      url = options.host ? join(options.host, url) : null;
    }
    return ignoreQuery(url);
  }

  if (typeof options.map === 'object') {
    if (options.map && options.map[path]) {
      path = ignoreQuery(options.map[path]);
    }
  } else if (typeof options.map === 'function') {
    path = options.map(path);
  }
  if(!path){
    return null;
  }
  return options.host ? join(options.host, path) : null;
}

function ignoreQuery(url) {
  return url ? url.split('?')[0] : null;
}

function getParsedBody(ctx){
  let body = ctx.request.body;
  if (body === undefined || body === null){
    return undefined;
  }
  const contentType = ctx.request.header['content-type'];
  if (!Buffer.isBuffer(body) && typeof body !== 'string'){
    if (contentType && contentType.indexOf('json') !== -1){
      body = JSON.stringify(body);
    } else {
      body += '';
    }
  }
  return body;
}

// function pipeRequest(readable, requestThunk){
//   return function(cb){
//     readable.pipe(requestThunk(cb));
//   }
// }
