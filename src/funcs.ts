import { IItem, IUser } from 'hacker-news-api-types';
import RSS from 'rss';

/**
 * Get the list of submissions of the user `whoishiring`.
 */
export const getSubmissions = async () => {
	const response = await fetch(`https://hacker-news.firebaseio.com/v0/user/whoishiring.json`);
	const user: IUser = await response.json();
	return user.submitted;
};

/**
 * Get the latest `Ask HN: Who is hiring?` post.
 * It's always the first post (index 0).
 */
export const getHiringPost = async (posts: number[]) => {
	const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${posts[0]}.json`);
	return response.json() as Promise<IItem>;
};

/**
 * Get the id of the last comment fetched.
 * Returns 0 if there isn't one.
 */
export const getLastCommentFetched = async (NAMESPACE: KVNamespace) => {
	const id = await NAMESPACE.get('lastCommentFetched');

	if (id) {
		return Number(id);
	} else {
		return 0;
	}
};

/**
 * Returns a list with each new comment's data.
 */
export const getNewCommentsData = async (ids: number[]) => {
	const commentPromiseList: Promise<Response>[] = [];

	ids.forEach((id) => {
		const promise = fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
		commentPromiseList.push(promise);
	});

	const responseList = await Promise.all(commentPromiseList);
	return Promise.all(responseList.map(async (response) => (await response.json()) as IItem));
};

function getExpirationDate(date: Date) {
	// Add 30 days to the date
	const expirationInMilliseconds = date.setDate(date.getDate() + 30);

	// Convert milliseconds to seconds
	return Math.floor(expirationInMilliseconds / 1000);
}

/**
 * Save Angular jobs to the database.
 */
export const saveAngularJobs = (newCommentsData: IItem[], NAMESPACE: KVNamespace) => {
	const writePromiseList: Promise<void>[] = [];

	newCommentsData.forEach((comment) => {
		if (comment && comment.text && /\b(angular|ionic|nativescript)\b/i.test(comment.text)) {
			console.log(comment.id + ' angular');

			const key = `comment:id:${comment.id}`;
			const by = comment.by;
			// Unix time (seconds) to milliseconds
			const time = comment.time ? new Date(comment.time * 1000) : new Date();
			const expiration = getExpirationDate(new Date(time.getTime()));

			writePromiseList.push(
				NAMESPACE.put(key, '', {
					metadata: { by, time },
					expiration,
				})
			);
		} else if (comment && comment.id) {
			console.log(comment.id + ' no angular');
		} else {
			console.log('(null) no angular');
		}
	});

	return Promise.all(writePromiseList);
};

/**
 * Serves a RSS feed with the comments.
 */
export const serveRSS = async (NAMESPACE: KVNamespace) => {
	const feed = new RSS({
		title: 'HN Angular Jobs RSS',
		feed_url: 'https://whoishiring-angular-rss.nuno2612.workers.dev/rss',
		site_url: 'https://whoishiring-angular-rss.nuno2612.workers.dev',
	});

	const prefix = 'comment:id:';
	const value = await NAMESPACE.list<any>({ prefix });
	const keys = value.keys;

	keys.forEach((key) => {
		const commentId = key.name.replace(prefix, '');
		const { by, time } = key.metadata;

		feed.item({
			title: `Comment by ${by}`,
			url: `https://news.ycombinator.com/item?id=${commentId}`,
			date: time,
			description: 'Open to see...',
		});
	});

	return new Response(feed.xml(), {
		headers: {
			'content-type': 'application/rss+xml',
		},
	});
};
