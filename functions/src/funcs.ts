import fetch, { Response } from "node-fetch";
import { IUser, IItem } from "hacker-news-api-types";
import * as RSS from "rss";
import * as functions from "firebase-functions";

/**
 * Get the list of submissions of the user `whoishiring`.
 */
export const getSubmissions = async () => {
  const response = await fetch(
    `https://hacker-news.firebaseio.com/v0/user/whoishiring.json`
  );
  const user: IUser = await response.json();
  return user.submitted;
};

/**
 * Get the latest `Ask HN: Who is hiring?` post.
 * It's always the first post (index 0).
 */
export const getHiringPost = async (posts: number[]) => {
  const response = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${posts[0]}.json`
  );
  return response.json() as Promise<IItem>;
};

/**
 * Get the id of the last comment fetched.
 * Returns 0 if there isn't one.
 */
export const getLastCommentFetched = async (
  infoCol: FirebaseFirestore.CollectionReference
) => {
  const documentSnapshot = await infoCol.doc("lastCommentFetched").get();

  if (documentSnapshot.exists) {
    const documentData = documentSnapshot.data();
    return documentData.id as number;
  } else {
    return 0;
  }
};

/**
 * Returns a list with each new comment's data.
 */
export const getNewCommentsData = async (ids: number[]) => {
  const commentPromiseList: Promise<Response>[] = [];

  ids.forEach(id => {
    const promise = fetch(
      `https://hacker-news.firebaseio.com/v0/item/${id}.json`
    );
    commentPromiseList.push(promise);
  });

  const responseList = await Promise.all(commentPromiseList);
  return Promise.all(
    responseList.map(async response => (await response.json()) as IItem)
  );
};

/**
 * Save Angular jobs to the database.
 */
export const saveAngularJobs = (
  newCommentsData: IItem[],
  commentsCol: FirebaseFirestore.CollectionReference
) => {
  const writePromiseList: Promise<FirebaseFirestore.WriteResult>[] = [];

  newCommentsData.forEach(comment => {
    if (
      comment &&
      comment.text &&
      /\b(angular|angularjs)\b/i.test(comment.text)
    ) {
      console.log(comment.id + " angular");

      writePromiseList.push(
        commentsCol.doc(`${comment.id}`).set({
          by: comment.by,
          // Unix time (seconds) to milliseconds
          time: new Date(comment.time * 1000)
        })
      );
    } else {
      console.log(comment.id + " no angular");
    }
  });

  return Promise.all(writePromiseList);
};

/**
 * Serves a RSS feed with the comments.
 */
export const serveRSS = async (
  commentsCol: FirebaseFirestore.CollectionReference,
  response: functions.Response
) => {
  const feed = new RSS({
    title: "HN Angular Jobs RSS",
    feed_url: "https://us-central1-whoishiring-angular.cloudfunctions.net/rss",
    site_url: "https://us-central1-whoishiring-angular.cloudfunctions.net"
  });

  const querySnapshot = await commentsCol
    .orderBy("time", "desc")
    .limit(100)
    .get();

  querySnapshot.forEach(documentSnapshot => {
    const comment = documentSnapshot.data();

    feed.item({
      title: `Comment by ${comment.by}`,
      url: `https://news.ycombinator.com/item?id=${documentSnapshot.id}`,
      date: comment.time.toDate(),
      description: "Open to see..."
    });
  });

  response.contentType("application/rss+xml");
  response.send(feed.xml());
};
