/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

interface SonarRequest {
	serverUrl: string;
	taskId: string;
	status: 'SUCCESS' | 'FAILED';
	analysedAt: Date;
	revision: string;
	changedAt: Date;
	project: {
		key: string;
		name: string;
		url: string;
	};
	branch: {
		name: string;
		type: 'BRANCH';
		isMain: boolean;
		url: string;
	};
	qualityGate: {
		name: string;
		status: 'OK' | 'FAILED';
		conditions: {
			metric: string;
			operator: 'LESS_THAN' | 'GREATER_THAN' | 'EQUAL';
			value: string;
			status: 'OK' | 'FAILED' | 'NO_VALUE';
			errorThreshold: string;
		}[];
	};
	properties: Record<string, string>;
}

interface DiscordWebhook {
	content: string;
	components?: object[];
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const body = await request.json<SonarRequest>();

		const content = `
		## ${body.status === 'SUCCESS' ? '✅' : '❌'} SonarQube Analysis ${body.status}
**Project**: [${body.project.name}](https://github.com/PI-FindIt/${body.project.name})
**Branch**: [${body.branch.name}](https://github.com/PI-FindIt/${body.project.name}/tree/${body.branch.name})
**Quality Gate**: ${body.qualityGate.status}
**Analysed At**: ${new Date(body.analysedAt)}
[View Analysis](${body.project.url})
`;

		const webhook: DiscordWebhook = {
			content,
		};

		const response = await fetch(env.DISCORD_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(webhook),
		});

		if (!response.ok) {
			return new Response(JSON.stringify(await response.json()), { status: 500 });
		}
		return new Response('Discord webhook sent', { status: 200 });
	},
} satisfies ExportedHandler<Env>;
