var stream = require('stream')
var through = require('through2')
var tar = require('tar-stream')
var levelup = require('levelup')
var leveljs = require('level-js')
var bayes = require('level-naive-bayes')
var csv = require('csv-parser')
var concat = require('concat-stream')
var zlib = require('zlib')
var xhr = require('xhr')
var onstoptyping = require('onstoptyping')

var tokenize = function(str) {
  return str ? str.trim().replace(/([^\w\s])/g, ' $1 ').trim().split(/\s+/) : []
}

var db = levelup('style', {db:leveljs})
var nb = bayes(db, {tokenize:tokenize})

var $progress = document.querySelector('#progress')
var $url = document.querySelector('#url')
var $train = document.querySelector('#train')
var $clear = document.querySelector('#clear')
var $textarea = document.querySelector('textarea')
var $user = document.querySelector('#user')

$url.onkeydown = function(e) {
  if (e.keyCode === 13) $train.onclick()
}

$clear.onclick = function() {
  $progress.innerHTML = 'clearing ...'

  db.createKeyStream()
    .pipe(through.obj(function(key, enc, cb) {
      db.del(key, cb)
    }))
    .on('finish', function() {
      $progress.innerHTML = 'clear!'
    })
}

$train.onclick = function() {
  var url = document.querySelector('#url').value.replace(/\/$/, '')

  if (url.indexOf('://github.com/') === -1) return alert('must be a github url')

  $progress.innerHTML = 'fetching repo ...'

  xhr({url:'http://cors.maxogden.com/'+encodeURI(url+'/archive/master.tar.gz'), responseType:'arraybuffer'}, function(err, res) {
    if (err) return alert(err.message)

    var name = url.split('://github.com/')[1].split('/')[0]
    var inc = 0

    zlib.gunzip(new Buffer(new Uint8Array(res.body)), function(err, buf) {
      tar.extract()
        .on('entry', function(header, stream, next) {
          if (!/\.js$/i.test(header.name)) {
            stream.resume()
            return next()
          }

          stream.pipe(concat(function(data) {
            $progress.innerHTML = '#'+(++inc)+' training '+header.name+' for '+name
            nb.train(name, data.toString(), next)
          }))
        })
        .end(buf)
    })
  })
}

onstoptyping($textarea, 500, function() {
  nb.classify($textarea.value, function(err, user) {
    if (user) $user.innerHTML = user
  })
})
