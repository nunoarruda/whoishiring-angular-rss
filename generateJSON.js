import { setTimeout } from 'timers';

const https = require('https');
const fs = require('fs');
const client = require('firebase-tools');

var jobs = [];

// STEP 1
// Get whoishiring's submissions
const getSubmissions = () => {
    https.get('https://hacker-news.firebaseio.com/v0/user/whoishiring.json', res => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);

        let data = '';
        res.on('data', d => data += d);

        res.on('end', () => {
            const submitted = JSON.parse(data).submitted;
            findLatestPost(submitted, 0);
        });
    
    }).on('error', error => {
        console.error("There was an error while getting whoishiring's submissions", error);
    });
};

// STEP 2
// Find the latest 'Ask HN: Who is hiring?' post
const findLatestPost = (posts, index) => {
    https.get(`https://hacker-news.firebaseio.com/v0/item/${posts[index]}.json`, res => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);

        let data = '';
        res.on('data', d => data += d);

        res.on('end', () => {
            const responseBody = JSON.parse(data);
            if (responseBody.title.includes('Ask HN: Who is hiring?')) getComment(responseBody.kids, 0);
            else findLatestPost(posts, ++index);
        });
    
    }).on('error', error => {
        console.error("There was an error while trying to find the latest 'Ask HN: Who is hiring?' post", error);
    });
};

// STEP 3
// Get all the post comments
const getComment = (ids, index) => {
    https.get(`https://hacker-news.firebaseio.com/v0/item/${ids[index]}.json`, res => {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);

        let data = '';
        res.on('data', d => data += d);

        res.on('end', () => {
            const comment = JSON.parse(data);
            isRemote(comment);
    
            if (++index < ids.length) getComment(ids, index);
            else generateJSON();
        });
    }).on('error', error => {
        console.error('There was an error while getting all the post comments', error);
        console.log('Trying again...');
        getComment(ids, index);
    });
};

const isRemote = comment => {
    if (comment.text && /\bremote\b/i.test(comment.text)) {
        console.log(comment.id + ' remote');
        saveJob(comment);
    } else {
        console.log(comment.id + ' not remote');
    }
};

const saveJob = comment => {
    jobs.push({
        id: comment.id,
        by: comment.by,
        time: comment.time
    });
};

const generateJSON = () => {
    console.log('Generating JSON file...');

    fs.writeFile('functions/data.json', JSON.stringify(jobs), err => {
        if (err) return console.log('Error while trying to write file', err);
        console.log('JSON file generated!');
        console.log('Deploying...');
        deploy();
    });
}

const deploy = () => {
    client.deploy({
        project: 'hiring-remote',
        token: '1/b8Dx6Ptqdz1iNFrdlTRyaM-u5CB0qaENTOH1JEyhBvA',
        cwd: './'
    }).then(() => {
        console.log('Rules have been deployed!')
        console.log('Repeating in 5 minutes...')
        setTimeout(getSubmissions, 300000);
    }).catch(err => {
        console.log({err});
    });
};

getSubmissions();
