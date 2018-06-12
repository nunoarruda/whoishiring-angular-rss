import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  getSubmissions,
  getHiringPost,
  getLastCommentFetched,
  getNewCommentsData,
  saveAngularJobs,
  serveRSS
} from "./funcs";

admin.initializeApp();

export const rss = functions.https.onRequest(async (request, response) => {
  const db = admin.firestore();
  const infoCol = db.collection("info");
  const commentsCol = db.collection("comments");

  try {
    const submissions = await getSubmissions();
    const hiringPost = await getHiringPost(submissions);

    // sort comments ids from oldest to newest
    const commentsIds = hiringPost.kids.sort((a, b) => a - b);

    const lastCommentFetchedId = await getLastCommentFetched(infoCol);
    const lastCommentFetchedIdIndex = commentsIds.indexOf(lastCommentFetchedId);
    const newCommentsIds = commentsIds.slice(lastCommentFetchedIdIndex + 1);

    if (newCommentsIds.length) {
      const newCommentsData = await getNewCommentsData(newCommentsIds);
      const saveAngularJobsResult = await saveAngularJobs(
        newCommentsData,
        commentsCol
      );
      console.log(saveAngularJobsResult);

      const newLastCommentFetchedId = newCommentsIds[newCommentsIds.length - 1];
      const saveLastCommentFetchedId = await infoCol
        .doc("lastCommentFetched")
        .set({ id: newLastCommentFetchedId });
      console.log(saveLastCommentFetchedId);
    }

    await serveRSS(commentsCol, response);
  } catch (err) {
    console.error(err);
  }
});
