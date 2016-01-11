var fs = require('fs');
var system = require('system');
var spawn = require("child_process").spawn

var page = require('webpage').create(),
    system = require('system'),
    address, output, size;
page.settings.resourceTimeout = 5000; // 5 seconds

system.stderr.write('admin_user cookie: ');
var admin_user = system.stdin.readLine();
admin_user = admin_user.replace(/%2F/g,'/');
admin_user = admin_user.replace(/%3A/g,':');
admin_user = admin_user.replace(/[\r\n]/g,'');

if (system.args.length < 3 || system.args.length > 5) {
    console.log('Usage: rasterize.js URL filename [paperwidth*paperheight|paperformat] [zoom]');
    console.log('  paper (pdf output) examples: "5in*7.5in", "10cm*20cm", "A4", "Letter"');
    console.log('  image (png/jpg output) examples: "1920px" entire page, window width 1920px');
    console.log('                                   "800px*600px" window, clipped to 800x600');
    phantom.exit(1);
} else {
    address = system.args[1];
    output = system.args[2];
    domain = address.match(/\/[^\/]+/)[0].replace('/','');

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
            makeError(output,'Unable to load the address: ' + status);
	    page.reload();
        } else if (!loggedIn) {
            makeError(output,'Cookie expired');
            phantom.exit(1);
        } else {
            renderLoop(output,1);
            var d = new Date()
            console.log(d.toString() + " Page loaded");
        }
    };
    page.open(address, function (status) {
        if (status !== 'success') {
            makeError(output,'Unable to open the address: ' + status);
            phantom.exit(1);
        } else {
            loggedIn = page.evaluate(function() {
                return document.getElementsByName('admin_user').length == 0;
            });
            if (!loggedIn) {
                makeError(output,'Cookie expired');
                phantom.exit(1);
            } else {
                var d = new Date()
                console.log(d.toString() + " Valid cookie");
                spawn('xscreensaver-command',['-lock']);
            }
        }
    });
}

function renderLoop(output,cnt) {
    phantom.addCookie(page.cookies[0]);
    if (page.render(output) && fs.exists(output)) {
        if (fs.exists('wall/' + output)) { fs.remove('wall/' + output); }
        fs.move(output,'wall/' + output);
        window.setTimeout(function(){renderLoop(output,2)},1000);
    } else {
        makeError(output,'Could not render page, reloading');
        if (fs.exists('wall/' + output)) { fs.remove('wall/' + output); }
	page.reload();
    }
}

function makeError(output,msg) {
    var d = new Date()
    console.log(d.toString() + ' ' + msg);
    spawn('convert',['-size','1920x1080','xc:black','-font','Palatino-Bold','-pointsize','32','-fill','red','-stroke','darkred','-draw','text 20,155 "'+d.toString()+'"','-draw','text 20,200 "'+msg+'"','wall/' + output]);
}
