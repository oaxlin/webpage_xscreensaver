var fs = require('fs');
var system = require('system');
var spawn = require("child_process").spawn;
var next_switch;
var renderInterval;

var ini = parseINIString(fs.read("/home/pi/webpage_xscreensaver/wall.ini"));
var page = new WebPage(), testindex = 0, loadInProgress = false;

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
    passRequired = page.evaluate(function(form_name,form_user_field) {
      var arr = document.getElementsByName(form_name);
      if (arr.length > 0 && arr[0].getAttribute('method') == "POST" && document.getElementsByName(form_user_field).length) {
        return 1;
      } else {
        return 0;
      }
    }, me['form_name'], me['form_user_field']);
    if ( passRequired ) {
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
          var arr = document.getElementsByName(form_name);
          console.log('Login page found, logging in');
          document.getElementsByName(form_user_field)[0].value = form_user;
          document.getElementsByName(form_pass_field)[0].value = form_pass;
          arr[0].submit();
        }, me['form_name'], me['form_user_field'], me['form_pass_field'], me['form_user'], me['form_pass'], me['form_pass_field']);
      }
      return;
    }
    delete me['form_pass_attempted'];
    renderInterval = window.setTimeout(function(){renderLoop(0)},500); // give the page a little time to to it's own javascript
  } 
];

function initPage() {
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
  if (cnt <= 0) {
    var d = new Date();
    next_switch = (d.getTime() / 1000) + (Number(ini['url'][pageCnt]['urltime']) || 60); // epoch
    console.log('rendering ' + page.url);
  }
  tf = 1;
  newContent = page.content;
  if (newContent != oldContent) {
    if (cnt > 0) {
      if ( page.render('/dev/shm/wall_tmp.gif', {format: 'gif'}) && fs.exists('/dev/shm/wall_tmp.gif')) {
        spawn('/bin/mv',['/dev/shm/wall_tmp.gif','/dev/shm/wall/wall_tmp.gif']); // fbi doesn't like copied files, it will occasionally crash if you use cp
        oldContent = newContent;
      } else {
        tf = 0;
        makeError('Could not render page',3);
      }
    }
  } 
  if (new Date().getTime() / 1000 > next_switch) {
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
  con = spawn('convert',['-size','1920x1080','xc:black','-font','Palatino-Bold','-pointsize','32','-fill','red','-stroke','darkred','-draw','text 20,155 "'+d.toString()+'"','-draw','text 20,200 "'+msg+'"','/dev/shm/wall_tmp.gif']);
  con.on('exit', function (c) {
    spawn('/bin/mv',['/dev/shm/wall_tmp.gif','/dev/shm/wall/wall_tmp.gif']); // fbi doesn't like copied files, it will occasionally crash if you use cp
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
