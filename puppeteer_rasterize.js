const puppeteer = require('puppeteer-core');
const fs = require('fs');
const readline = require('readline');
const readInterface = readline.createInterface({
    input: fs.createReadStream('wall.ini'),
    console: false
});

var capture_page;
var browser;
var page;
var config = [];
var restart = 86400000; // reduce memory leak issues by restaring periodically

async function init_config() {
	var regex = {
		param: /^\s*([\w\.\-\_]+)\s*=\s*(.*?)\s*$/,
		comment: /^\s*;.*$/
	};
	var local = {
        urltime: 60,
        softrefresh: 86400,
        zoom: 1,
    };
	await readInterface.on('line', function(line) {
		var match = line.match(regex.param);
		if (match) {
		  if (match[1] == 'time') {
			local['urltime'] = parseInt(match[2]);
		  } else if (match[1] == 'softrefresh') {
			local['softrefresh'] = parseInt(match[2]);
		  } else if (match[1] == 'restart') {
			restart = parseInt(match[2]) * 1000;
		  } else if (match[1] == 'zoom') { // may not work?
			local['zoom'] = parseFloat(match[2]);
		  } else if (match[1] == 'url') {
			local['url'] = match[2];
			config.push(local);
			local = JSON.parse(JSON.stringify(local)); // clone the object
		  } else if (match[1] == 'form_name') { // not supported
			local['form_name'] = match[2];
		  } else if (match[1] == 'form_user') { // not supported
			local['form_user'] = match[2];
		  } else if (match[1] == 'form_user_field') { // not supported
			local['form_user_field'] = match[2];
		  } else if (match[1] == 'form_pass_field') { // not supported
			local['form_pass_field'] = match[2];
		  } else if (match[1] == 'form_pass_file') { // not supported
			local['form_pass_file'] = match[2];
		  } else if (match[1] == 'form_pass') { // not supported
			local['form_pass'] = match[2];
		  };
		};
	}).on('close', function() {;
		console.log('Finished loading configs:',config);
    })
}

async function do_exit() {
    console.log('exiting screenshot tool');
    process.exit(0);
}

async function run(cnt) {
	await page.evaluate((custom_screen_zoom) => {
        document.body.style.zoom=custom_screen_zoom
	},config[cnt].zoom);
    await page.screenshot({ path: '/dev/shm/wall_tmp.jpg', fullPage: true })
    fs.rename('/dev/shm/wall_tmp.jpg', '/dev/shm/wall/wall_tmp.jpg', function(err) {} )
    console.log('image render completed');
    capture_page = setTimeout(run, config[cnt].softrefresh * 1000, cnt);
}

async function init_page(cnt) {
    if (cnt >= config.length) { cnt = 0 }
    clearInterval(capture_page);
    console.log('Loading config:',config[cnt].url);
    await page.setViewport({ width: 1920, height: 1080 })
    await page.goto(config[cnt].url);
    console.log('init page completed');
    setTimeout(init_page, config[cnt].urltime * 1000, cnt+1);
    run(cnt);
}

async function init_puppeteer() {
    browser = await puppeteer.launch({
       headless: true,
       executablePath:'/usr/bin/chromium-browser',
       args: [
           '--no-sandbox',
           '--disable-setuid-sandbox',
       ]
    });
    page = await browser.newPage()
    console.log('puppeteer inialized');
    init_page(0);
}

setTimeout(do_exit, restart);
init_config();
init_puppeteer();
