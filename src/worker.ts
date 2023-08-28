/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { getHiringPost, getLastCommentFetched, getNewCommentsData, getSubmissions, saveAngularJobs, serveRSS } from './funcs';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;

	WHOISHIRING_ANGULAR: KVNamespace;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const { pathname } = new URL(request.url);
		if (pathname === '/rss') {
			try {
				return await serveRSS(env.WHOISHIRING_ANGULAR);
			} catch (error) {
				console.error(error);
			}
		}

		return new Response('Hello World!');
	},

	async scheduled(event: ScheduledEvent, env: Env) {
		try {
			const submissions = await getSubmissions();

			if (submissions) {
				const hiringPost = await getHiringPost(submissions);

				if (hiringPost.kids) {
					// sort comments ids from oldest to newest
					const commentsIds = hiringPost.kids.sort((a, b) => a - b);

					const lastCommentFetchedId = await getLastCommentFetched(env.WHOISHIRING_ANGULAR);
					const lastCommentFetchedIdIndex = commentsIds.indexOf(lastCommentFetchedId);
					const start = lastCommentFetchedIdIndex + 1;
					const end = start + 1; // check 1 new comment in each cron iteration to avoid request limit errors
					const newCommentsIds = commentsIds.slice(start, end);

					if (newCommentsIds.length) {
						const newCommentsData = await getNewCommentsData(newCommentsIds);
						await saveAngularJobs(newCommentsData, env.WHOISHIRING_ANGULAR);
						const newLastCommentFetchedId = newCommentsIds[newCommentsIds.length - 1];
						await env.WHOISHIRING_ANGULAR.put('lastCommentFetched', newLastCommentFetchedId.toString());
					}
				}
			}
		} catch (error) {
			console.error(error);
		}
	},
};
