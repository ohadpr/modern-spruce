const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const yaml = require('js-yaml');

const stackbitPullApiUrl = url.parse("https://api.stackbit.com/pull/5d250543c3212c00127d83c2");
const API_KEY = process.env['STACKBIT_API_KEY'];
const data = JSON.stringify({apiKey: API_KEY});

const options = {
    host: stackbitPullApiUrl.host,
    path: stackbitPullApiUrl.path,
    protocol: stackbitPullApiUrl.protocol,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let respdata = '';
    res.on('data', chunk => {
        respdata += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 404) {
            throw new Error('Project not found');
        }

        let response;

        try {
            response = JSON.parse(respdata);
        } catch (err) {
            throw new Error(`Failed to serialize response json`);
        }

        if (res.statusCode >= 400) {
            throw new Error(`Failed to build project, statusCode: ${res.statusCode}, response: ${JSON.stringify(response)}`);
        }

        for (let i = 0; i < response.length; i++) {
            const fullPath = path.join(__dirname, response[i].filePath);
            ensureDirectoryExistence(fullPath);
            if (fs.existsSync(fullPath) && ['yml','yaml','json'].includes(path.extname(fullPath).substring(1))){
                response[i].data = mergeConfig(fullPath, response[i].data);
            }
            console.log('creating file', fullPath);
            fs.writeFileSync(fullPath, response[i].data);
        }
    });
});

function loadLocalConfig(filepath) {
        const extension = path.extname(filepath).substring(1);
        let content = fs.readFileSync(filepath);
        let result;
        switch (extension) {
        case 'yml':
        case 'yaml':
            result = yaml.safeLoad(content);
            break;
        case 'json':
            result = JSON.parse(content);
            break;
        default:
            return null
        }
        return result;
}

function mergeConfig(fullPath, remoteData) {
    let localObj;

    try {
        localObj = loadLocalConfig(fullPath);
    } catch (err) {
        throw new Error(`Could not parse config at ${fullPath}`);
    }

    if (localObj) {
        let remoteObj;
        if (['yml','yaml'].includes(path.extname(fullPath).substring(1))) {
            remoteObj = yaml.safeLoad(remoteData);
            return yaml.safeDump(Object.assign(localObj, remoteObj));
        } else {
            try {
                remoteObj = JSON.parse(remoteData);
            } catch (err) {
                throw new Error('Remote data provided in wrong format');
            }
            return JSON.stringify(Object.assign(localObj, remoteObj), null, 4);
        }
    }

    return remoteData;
}

req.on('error', (e) => {
  throw new Error(`Error fetching project build: ${e.message}`);
});

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

console.log(`fetching data for project from ${stackbitPullApiUrl.href}`);
req.write(data);
req.end();
