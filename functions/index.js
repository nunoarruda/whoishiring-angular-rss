const functions = require('firebase-functions');
const admin = require('firebase-admin'); 
const RSS = require('rss');
const fs = require('fs');

admin.initializeApp(functions.config().firebase); 

exports.rss = functions.https.onRequest((functionsRequest, functionsResponse) => {
    const feed = new RSS({
        title: 'HN Hiring Remote RSS',
        feed_url: 'https://us-central1-hiring-remote.cloudfunctions.net/rss',
        site_url: 'https://us-central1-hiring-remote.cloudfunctions.net'
    });

    fs.readFile('./data.json', 'utf8', (err, data) => {
        const comments = JSON.parse(data);
        
        // sort comments by time
        comments.sort((a, b) => b.time - a.time);

        // create feed items
        comments.forEach(comment => {
            feed.item({
                title: `Comment by ${comment.by}`,
                url: `https://news.ycombinator.com/item?id=${comment.id}`,
                date: new Date(comment.time * 1000) // Unix time (seconds) to milliseconds
            });
        });

        // serve RSS
        functionsResponse.contentType('application/rss+xml');
        functionsResponse.send(feed.xml());
    });
});
