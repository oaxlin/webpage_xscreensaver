var fs = require('fs');
var system = require('system');
var spawn = require("child_process").spawn;

var timer;
var page;
var address;
var output;
var size;
var ini;
var last_request = 0;
var whichkey = -1;
var next_switch;
var new_request = 1;
var admin_user;

if (fs.exists("wall.ini")) {
    ini = parseINIString(fs.read("wall.ini"));
    console.log('wall.ini found, URL from arg list will be ignored');
} else {
    ini['url'] = [600,system.args[1]];
}
if (fs.exists("wall_cookie.txt")) {
    ini['admin_user'] = fs.read("wall_cookie.txt");
}
if (ini['admin_user']) {
    // make it so a copied cookie from Chrome (with %XX escape characters) will work
    ini['admin_user'] = ini['admin_user'].replace(/%2F/g,'/');
    ini['admin_user'] = ini['admin_user'].replace(/%3A/g,':');
    ini['admin_user'] = ini['admin_user'].replace(/[\r\n\s]+$/g,'');
}

if (system.args.length < 3 || system.args.length > 5) {
    console.log('Usage: rasterize.js URL filename [paperwidth*paperheight|paperformat] [zoom]');
    console.log('  paper (pdf output) examples: "5in*7.5in", "10cm*20cm", "A4", "Letter"');
    console.log('  image (png/jpg output) examples: "1920px" entire page, window width 1920px');
    console.log('                                   "800px*600px" window, clipped to 800x600');
    phantom.exit(1);
} else {
    admin_user = ini['admin_user'];
    initPage();
}

function initPage() {
    whichkey = whichkey + 1;
    if (! ini['url'][whichkey]) { whichkey = 0; }
    page = require('webpage').create(),
        system = require('system'),
        address, output, size;
    page.settings.resourceTimeout = 5000; // 5 seconds
    var d = new Date()
    next_switch = (d.getTime() / 1000) + Number(ini['url'][whichkey][0]); // epoch

    address = ini['url'][whichkey][1];
    output = system.args[2];
    domain = address.match(/\/[^\/]+/)[0].replace('/','');
    last_request = 0;

    phantom.addCookie({
        "name": "admin_user",
        "value": admin_user,
        "domain": domain
    });

    page.viewportSize = { width: 600, height: 600 };
    if (system.args.length > 3 && system.args[2].substr(-4) === ".pdf") {
        size = system.args[3].split('*');
        page.paperSize = size.length === 2 ? { width: size[0], height: size[1], margin: '0px' }
                                           : { format: system.args[3], orientation: 'portrait', margin: '1cm' };
    } else if (system.args.length > 3 && system.args[3].substr(-2) === "px") {
        size = system.args[3].split('*');
        if (size.length === 2) {
            pageWidth = parseInt(size[0], 10);
            pageHeight = parseInt(size[1], 10);
            page.viewportSize = { width: pageWidth, height: pageHeight };
            page.clipRect = { top: 0, left: 0, width: pageWidth, height: pageHeight };
        } else {
            console.log("size:", system.args[3]);
            pageWidth = parseInt(system.args[3], 10);
            pageHeight = parseInt(pageWidth * 3/4, 10); // it's as good an assumption as any
            console.log ("pageHeight:",pageHeight);
            page.viewportSize = { width: pageWidth, height: pageHeight };
        }
    }
    if (system.args.length > 4) {
        page.zoomFactor = system.args[4];
    }
    page.onLoadFinished = function(status) {
        loggedIn = page.evaluate(function() {
            return document.getElementsByName('admin_user').length == 0;
        });
        if (status !== 'success') {
            makeError(output,'Unable to load the address: ' + status,0);
        } else if (!loggedIn) {
            if (fs.exists("/dev/shm/wall_cookie.txt")) {
                fs.remove("/dev/shm/wall_cookie.txt");
            }
            makeError(output,'Cookie expired',1);
        } else {
            var d = new Date()
            console.log(d.toString() + " Page loaded");
        }
    };
    page.onResourceError = function(resourceError) {
        system.stdout.writeLine('= onResourceError()');
        system.stdout.writeLine('  - unable to load url: "' + resourceError.url + '"');
        system.stdout.writeLine('  - error code: ' + resourceError.errorCode + ', description: ' + resourceError.errorString );
    };
    page.onError = function(msg, trace) {
        system.stdout.writeLine('= onError()');
        var msgStack = ['  ERROR: ' + msg];
        if (trace) {
            msgStack.push('  TRACE:');
            trace.forEach(function(t) {
                msgStack.push('    -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
            });
        }
        system.stdout.writeLine(msgStack.join('\n'));
    };
    page.open(address, function (status) {
        if (status !== 'success') {
            makeError(output,'Unable to open the address: ' + status,0);
        } else {
            loggedIn = page.evaluate(function() {
                return document.getElementsByName('admin_user').length == 0;
            });
            if (!loggedIn) {
                if (fs.exists("/dev/shm/wall_cookie.txt")) {
                    fs.remove("/dev/shm/wall_cookie.txt");
                }
                makeError(output,'Cookie expired',1);
            } else {
                var d = new Date()
                console.log(d.toString() + " Valid cookie");
                renderLoop(output,1);
                spawn('xscreensaver-command',['-lock']);
            }
        }
    });
}

function renderLoop(output,cnt) {
    if (cnt == 1) {
        var foo = page.evaluate(function() {
            // override the normal delay
            update_wallboard(Object.keys(document.last_request)[0],3);
        });
    }
    new_request = page.evaluate(function() { return document.last_request[Object.keys(document.last_request)[0]]; });
    tf = 1;
    if (last_request < new_request) {
        last_request = new_request;
        phantom.addCookie(page.cookies[0]);
        admin_user = page.cookies[0].value;
        fs.write("wall_cookie.txt", admin_user, 'w');
        if (page.render('/dev/shm/' + output, {format: 'gif'}) && fs.exists('/dev/shm/' + output)) {
            if (fs.exists('/dev/shm/wall/' + output)) { fs.remove('/dev/shm/wall/' + output); }
            fs.move('/dev/shm/' + output,'/dev/shm/wall/' + output);
            if (new Date().getTime() / 1000 > next_switch) {
                page.close;
                tf = 0;
                initPage();
            }
        } else {
            tf = 0;
            makeError(output,'Could not render page',0);
        }
    }
    if (tf == 1) {
        timer = window.setTimeout(function(){renderLoop(output,2)},500);
    }
}

function makeError(output,msg,code) {
    var d = new Date()
    console.log(d.toString() + ' ' + msg);
    spawn('convert',['-size','1920x1080','xc:black','-font','Palatino-Bold','-pointsize','32','-fill','red','-stroke','darkred','-draw','text 20,155 "'+d.toString()+'"','-draw','text 20,200 "'+msg+'"','wall/' + output]);
    phantom.exit(code); // 0 should be safe to restart automatically, anything else means auto restart will likely fail
}

function parseINIString(data){
    var regex = {
        param: /^\s*([\w\.\-\_]+)\s*=\s*(.*?)\s*$/,
        comment: /^\s*;.*$/
    };
    var value = {};
    var lines = data.split(/\r\n|\r|\n/);
    var section = null;
    var urltime = 600;
    value['url'] = [];
    lines.forEach(function(line){
        var match = line.match(regex.param);
        if (match && match[1] == 'time') {
            urltime = match[2];
        } else if (match && match[1] == 'url') {
            value['url'].push([urltime,match[2]]);
        } else if (match && match[1] == 'admin_user') {
            value['admin_user'] = match[2];
        };
    });
    return value;
}
