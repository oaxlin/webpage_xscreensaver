var fs = require('fs');
var system = require('system');
var spawn = require("child_process").spawn;
var next_switch;
var rerender_timer;
var renderInterval;

var ini = parseINIString(fs.read("/home/pi/webpage_xscreensaver/wall.ini"));
var page = new WebPage(), testindex = 0, loadInProgress = false;
var quit_timer = new Date().getTime() + ((Number(ini['url'][0]['restart']) || 86400)*1000);

// the phantom default cookie handling sucks, for some reason it deletes
// valid cookies, so we manually save a last know "good" copy on each
// successful load and try to read it in case the default way borked
var last_cookies_file = "/dev/shm/wall_cookies_success.txt";
if(fs.exists(last_cookies_file)) {
  var last_cookies = fs.read(last_cookies_file);
  JSON.parse(last_cookies).forEach(function(arg,i) {
    // addCookie is retarded and adds an extra DOT, so I have to strip off the last
    // subdomain in order to make cookies work
    arg['domain'] = arg['domain'].replace(/^\w+\./,'');
    phantom.addCookie(arg);
  });
}

pageWidth = 1920;
pageHeight = 1080;
page.viewportSize = { width: pageWidth, height: pageHeight };
page.clipRect = { top: 0, left: 0, width: pageWidth, height: pageHeight };

var pageCnt = -1;
var oldContent = '';

page.onConsoleMessage = function(msg) {
  console.log(msg);
};

page.onLoadStarted = function() {
  loadInProgress = true;
  console.log("loading page");
};

page.onLoadFinished = function(status) {
  console.log("loaded " + page.url);
  if (status !== 'success') {
    makeError('Unable to load the address: ' + status,1);
  }
  page.evaluate(function() {
    if (typeof document.body.bgColor != 'undefined') {
      document.body.bgColor = 'white';
    }
  });
  loadInProgress = false;
};

phantom.onError = function(msg, trace) {
  var msgStack = ['PHANTOM ERROR: ' + msg];
  if (trace && trace.length) {
    msgStack.push('TRACE:');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
    });
  }
  console.error(msgStack.join('\n'));
  makeError('Uncaught javascript error on page',6);
}

var steps = [
  function() {
    //Load Login Page
    page.zoomFactor = ini['url'][pageCnt]['zoom'];
    page.open(ini['url'][pageCnt]['url']);
  },
  function() {
    //Enter Credentials
    me = ini['url'][pageCnt];
    if ( typeof me['form_pass_attempted'] != 'undefined' ) {
      // make sure we don't keep retrying the same password over and over
      delete me['form_pass'];
    }
    passRequired = page.evaluate(function(form_name,form_user_field,form_pass_field) {
      if (!form_name && !form_user_field) {
        return 0;
      }
      err_cnt = 0;
      if (document.getElementsByName(form_name).length != 1) {
        if (document.getElementsByName(form_pass_field).length == 1) {
          // Avoid scaring people, only warn if we find the password field
          console.log("Could not find form_name (" + form_name + ")");
        }
        return 0; //They are logged it (or the name is spelled wrong)
      }
      if (document.getElementsByName(form_pass_field).length != 1) {
        console.log("Could not find form_pass_field (" + form_pass_field + ")");
        err_cnt = 1;
      }
      if (document.getElementsByName(form_user_field).length != 1) {
        console.log("Could not find form_user_field (" + form_user_field + ")");
        err_cnt = 1;
      }
      if (err_cnt > 0) {
        return 2;
      }
      return 1;
    }, me['form_name'], me['form_user_field'], me['form_pass_field']);
    if ( passRequired ) {
      if ( passRequired == 2 ) {
        makeError('Invalid wall.ini form settings',5);
      }
      if ( typeof me['form_pass_file'] != 'undefined' && typeof me['form_pass'] == 'undefined' ) {
        if ( fs.exists(me['form_pass_file']) ) {
          console.log('Loading password from file: ' + me['form_pass_file']);
          me['form_pass'] = fs.read(me['form_pass_file']);
          spawn('/bin/rm',[me['form_pass_file']]); // remove the file
        }
      }
      if ( typeof me['form_pass'] == 'undefined' ) {
        e = 'Password is required';
        if ( me['form_pass_file'] ) {
          e = e + "\n\nPassword file not found:\n" + me['form_pass_file'];
        }
        makeError(e,4);
      }
      me['form_pass_attempted'] = 1;
      testindex = 0; // try again
      if ( me['form_pass'] ) {
        page.evaluate(function(form_name,form_user_field,form_pass_field,form_user,form_pass,form_pass_field) {
          console.log('Login page found, logging in');
          document.getElementsByName(form_user_field)[0].value = form_user;
          document.getElementsByName(form_pass_field)[0].value = form_pass;
          document.getElementsByName(form_name)[0].submit();
        }, me['form_name'], me['form_user_field'], me['form_pass_field'], me['form_user'], me['form_pass'], me['form_pass_field']);
      }
      return;
    }
    delete me['form_pass_attempted'];
    renderInterval = window.setTimeout(function(){renderLoop(0)},500); // give the page a little time to to it's own javascript
  } 
];

function initPage() {
  oldContent = '';
  pageCnt = pageCnt + 1;
  if ( ! ini['url'][pageCnt] ) { pageCnt = 0 }
  testindex = 0;
  loadingInterval = setInterval(function() {
    if (!loadInProgress && typeof steps[testindex] == "function") {
      console.log("step " + (testindex + 1));
      steps[testindex]();
      testindex++;
    }
    if (typeof steps[testindex] != "function") {
      clearInterval(loadingInterval);
    }
  }, 50);
}
initPage();

function renderLoop(cnt) {
  var d = new Date();
  if (cnt <= 0) {
    next_switch = (d.getTime() / 1000) + (Number(ini['url'][pageCnt]['urltime']) || 60); // epoch
    console.log('rendering ' + page.url);
  }
  tf = 1;
  newContent = page.content;
  if (d.getTime() > quit_timer) {
    // just in case of memory leaks, allow us to restart phantomjs once in a while
    console.log('Shutting down, restart timer exceeded');
    phantom.exit(0);
  }
  if ((d.getTime() > rerender_timer) || newContent != oldContent) {
    if (cnt > 0) {
      if ( page.render('/dev/shm/wall_tmp.jpg', {format: 'jpeg'}) && fs.exists('/dev/shm/wall_tmp.jpg')) {
        rerender_timer = d.getTime() + ((Number(ini['url'][pageCnt]['softrefresh']) || 900)*1000);
        spawn('/bin/mv',['/dev/shm/wall_tmp.jpg','/dev/shm/wall/wall_tmp.jpg']); // fbi doesn't like copied files, it will occasionally crash if you use cp
        oldContent = newContent;
        if (phantom.cookies.length > 0) {
          fs.write(last_cookies_file,JSON.stringify(phantom.cookies),'w');
        }
      } else if (cnt < 5) {
        // It's possible to get here on comples javascript only pages
        // give the page sufficient time to (hopefully) render before giving up
        renderInterval = window.setTimeout(function(){renderLoop(cnt+1)},1000);
        console.log('Unable to render page, waiting 1 second and trying again.');
        return;
      } else {
        tf = 0;
        makeError('Could not render page: ' + JSON.stringify(page),3);
      }
    }
  } 
  if (d.getTime() / 1000 > next_switch) {
    page.clearMemoryCache();
    page.close;
    tf = 0;
    initPage();
  }
  if (tf == 1) {
    renderInterval = window.setTimeout(function(){renderLoop(1)},100);
  }
}

function makeError(msg,code) {
  clearInterval(loadingInterval);
  clearInterval(renderInterval);
  var d = new Date()
  page.close;
  console.log(d.toString() + ' ' + msg);
  con = spawn('convert',['-size','1920x1080','xc:black','-font','Palatino-Bold','-pointsize','32','-fill','red','-stroke','darkred','-draw','text 20,155 "'+d.toString()+'"','-draw','text 20,200 "'+msg+'"','/dev/shm/wall_tmp.jpg']);
  con.on('exit', function (c) {
    spawn('/bin/mv',['/dev/shm/wall_tmp.jpg','/dev/shm/wall/wall_tmp.jpg']); // fbi doesn't like copied files, it will occasionally crash if you use cp
    console.log("exit code: " + code);
    phantom.exit(code);
  });
}

function parseINIString(data){
  var regex = {
    param: /^\s*([\w\.\-\_]+)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  };
  var value = {};
  var local = {};
  var lines = data.split(/\r\n|\r|\n/);
  value['url'] = [];
  lines.forEach(function(line){
    var match = line.match(regex.param);
    if (match) {
      if (match[1] == 'time') {
        local['urltime'] = match[2];
      } else if (match[1] == 'softrefresh') {
        local['softrefresh'] = match[2];
      } else if (match[1] == 'restart') {
        local['restart'] = match[2];
      } else if (match[1] == 'zoom') {
        local['zoom'] = match[2];
      } else if (match[1] == 'url') {
        local['url'] = match[2];
        value['url'].push(local);
        local = {};
      } else if (match[1] == 'form_name') {
        local['form_name'] = match[2];
      } else if (match[1] == 'form_user') {
        local['form_user'] = match[2];
      } else if (match[1] == 'form_user_field') {
        local['form_user_field'] = match[2];
      } else if (match[1] == 'form_pass_field') {
        local['form_pass_field'] = match[2];
      } else if (match[1] == 'form_pass_file') {
        local['form_pass_file'] = match[2];
      } else if (match[1] == 'form_pass') {
        local['form_pass'] = match[2];
      };
    };
  });
  return value;
}
