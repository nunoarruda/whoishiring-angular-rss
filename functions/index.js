const functions = require('firebase-functions');
const request = require('request');
const RSS = require('rss');

exports.rss = functions.https.onRequest((functionsRequest, functionsResponse) => {
    // STEP 1
    // Get the latest 'Ask HN: Who is hiring?' post

    request('https://hacker-news.firebaseio.com/v0/user/whoishiring.json', (error, response, body) => {
        // List of whoishiring's submissions
        const submitted = JSON.parse(body).submitted;

        // Find the latest 'Ask HN: Who is hiring?' post
        findLatestPost(submitted, 0);
    });

    const findLatestPost = (posts, index) => {
        request(`https://hacker-news.firebaseio.com/v0/item/${posts[index]}.json`, (error, response, body) => {
            const responseBody = JSON.parse(body);

            if (responseBody.title.includes('Ask HN: Who is hiring?')) {
                getComments(responseBody.kids, responseBody.kids.length);
            } else {
                findLatestPost(posts, ++index);
            }
        });
    };

    // STEP 2
    // Get all the post comments

    const getComments = (ids, totalComments) => {
        const comments = [];
        let responsesReceived = 0;

        ids.forEach(id => {
            request(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, (error, response, body) => {
                const comment = JSON.parse(body);
                
                // filter comments
                if (comment.text && comment.text.includes('remote')) {
                    comments.push(comment);
                }

                if (++responsesReceived == totalComments) {
                    // Last response received, sort comments by time and serve RSS
                    comments.sort((a, b) => b.time - a.time);
                    serveRSS(comments);
                }
            });
        });
    };

    // STEP 3
    // Serve comments as RSS feed
    const serveRSS = comments => {
        const feed = new RSS({
            title: 'HN Hiring Remote RSS',
            feed_url: 'https://us-central1-hiring-remote.cloudfunctions.net/rss',
            site_url: 'https://us-central1-hiring-remote.cloudfunctions.net'
        });

        comments.forEach(comment => {
            feed.item({
                title: `Comment by ${comment.by}`,
                url: `https://news.ycombinator.com/item?id=${comment.id}`,
                date: new Date(comment.time * 1000), // Unix time (seconds) to milliseconds
                description: comment.text
            });
        });

        functionsResponse.contentType('application/rss+xml');
        functionsResponse.send(feed.xml());
    };
});
