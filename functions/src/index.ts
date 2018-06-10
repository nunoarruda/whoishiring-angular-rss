import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as request from "request";
import * as RSS from "rss";

admin.initializeApp();

export const rss = functions.https.onRequest(
  (functionsRequest, functionsResponse) => {
    const db = admin.firestore();
    const commentsCol = db.collection("comments");
    const infoCol = db.collection("info");

    const feed = new RSS({
      title: "HN Angular Jobs RSS",
      feed_url:
        "https://us-central1-whoishiring-angular.cloudfunctions.net/rss",
      site_url: "https://us-central1-whoishiring-angular.cloudfunctions.net"
    });

    // STEP 8
    // Serve RSS
    const serveRSS = () => {
      commentsCol
        .orderBy("time", "desc")
        .limit(100)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            const comment = doc.data();

            // create feed items
            feed.item({
              title: `Comment by ${comment.by}`,
              url: `https://news.ycombinator.com/item?id=${doc.id}`,
              date: comment.time,
              description: "Open to see..."
            });
          });

          functionsResponse.contentType("application/rss+xml");
          functionsResponse.send(feed.xml());
        })
        .catch(err => console.log(err));
    };

    // STEP 7
    // Save the id of the last comment fetched
    const saveLastCommentFetched = id => {
      infoCol
        .doc("lastCommentFetched")
        .set({ id })
        .then(() => console.log("last comment fetched saved"))
        .catch(error =>
          console.log("error while saving last comment fetched", error)
        );
    };

    // STEP 6
    // Save Angular job to database
    const saveAngularJob = obj => {
      commentsCol
        .doc(`${obj.id}`)
        .set({ by: obj.by, time: obj.time })
        .then(() => console.log("Job saved successfully to DB"))
        .catch(error => console.log("Job could not be saved to DB" + error));
    };

    // STEP 5
    // Get comments
    const getComment = (ids, index) => {
      request(
        `https://hacker-news.firebaseio.com/v0/item/${ids[index]}.json`,
        (error, response, body) => {
          if (!error && response.statusCode === 200) {
            const comment = JSON.parse(body);
            if (comment && comment.text) {
              if (/\b(angular|angularjs)\b/i.test(comment.text)) {
                console.log(comment.id + " angular");

                saveAngularJob({
                  id: comment.id,
                  by: comment.by,
                  time: new Date(comment.time * 1000) // Unix time (seconds) to milliseconds
                });
              } else {
                console.log(comment.id + " no angular");
              }
            } else {
              console.log(`${ids[index]} comment is falsy, moving on...`);
            }

            if (index + 1 < ids.length) {
              getComment(ids, index + 1);
            } else {
              // Last iteration
              saveLastCommentFetched(ids[index]);
              serveRSS();
            }
          } else {
            console.log(
              `There was an error while trying to get comment ${ids[index]}`,
              error
            );
            console.log("Trying again...");
            getComment(ids, index);
          }
        }
      );
    };

    // STEP 4
    // Get the last comment fetched
    const getLastCommentFetched = ids => {
      infoCol
        .doc("lastCommentFetched")
        .get()
        .then(documentSnapshot => {
          if (documentSnapshot.exists) {
            // Get comments starting from the last comment fetched
            const documentData = documentSnapshot.data();
            const lastCommentFetchedId = documentData.id;
            const lastCommentFetchedIndex = ids.indexOf(lastCommentFetchedId);
            const slicedIds = ids.slice(lastCommentFetchedIndex + 1);
            if (slicedIds.length) {
              console.log(`There's new comments. Fetching...`);
              getComment(ids, lastCommentFetchedIndex + 1);
            } else {
              console.log(`No new comments, serve RSS...`);
              serveRSS();
            }
          } else {
            getComment(ids, 0);
          }
        })
        .catch(err => console.log(err));
    };

    // STEP 3
    // Order comment ids, from oldest to newest
    const orderKids = kids => {
      kids.sort((a, b) => a - b);

      getLastCommentFetched(kids);
    };

    // STEP 2
    // Find the latest 'Ask HN: Who is hiring?' post
    const findLatestPost = (posts, index) => {
      request(
        `https://hacker-news.firebaseio.com/v0/item/${posts[index]}.json`,
        (error, response, body) => {
          if (!error && response.statusCode === 200) {
            const responseBody = JSON.parse(body);

            if (responseBody.title.includes("Ask HN: Who is hiring?")) {
              orderKids(responseBody.kids);
            } else {
              findLatestPost(posts, index + 1);
            }
          } else {
            console.log(
              "There was an error while trying to find the latest 'Ask HN: Who is hiring?' post",
              error
            );
            console.log("Trying again...");
            findLatestPost(posts, index);
          }
        }
      );
    };

    // STEP 1
    // Get whoishiring's submissions
    const getSubmissions = () => {
      request(
        "https://hacker-news.firebaseio.com/v0/user/whoishiring.json",
        (error, response, body) => {
          if (!error && response.statusCode === 200) {
            // List of whoishiring's submissions
            const submitted = JSON.parse(body).submitted;

            findLatestPost(submitted, 0);
          } else {
            console.log(
              "There was an error while trying to get whoishiring's submissions",
              error
            );
            console.log("Trying again...");
            getSubmissions();
          }
        }
      );
    };

    // Init
    getSubmissions();
  }
);
