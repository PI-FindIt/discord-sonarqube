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
			status: 'OK' | 'ERROR' | 'NO_VALUE';
			errorThreshold: string;
		}[];
	};
	properties: Record<string, string>;
}

interface DiscordWebhook {
	content: string;
	components?: object[];
}

const correspondence = {
	LESS_THAN: '<',
	GREATER_THAN: '>',
	EQUAL: '=',
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const uuid = request.url.split('/').pop();

		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		if (uuid !== env.SONAR_UUID) {
			return new Response('Unauthorized', { status: 401 });
		}

		const body = await request.json<SonarRequest>();
		const failedConditions = body.qualityGate.conditions.filter((condition) => condition.status === 'ERROR');

		const content = `
		## ${body.qualityGate.status === 'OK' ? '✅' : '❌'} SonarQube Analysis ${body.qualityGate.status}
**Project**: [${body.project.name}](https://github.com/PI-FindIt/${body.project.name})
**Branch**: [${body.branch.name}](https://github.com/PI-FindIt/${body.project.name}/tree/${body.branch.name})
**Analysed At**: ${new Date(body.analysedAt)}
[View Analysis](${body.project.url})

${failedConditions.length > 0 ? '### ⚠️ Failed Conditions' : ''}
${failedConditions
	.map(
		(condition) => `
- **${condition.metric.replaceAll('_', ' ')}**: ${condition.value} ${correspondence[condition.operator]} ${condition.errorThreshold}`,
	)
	.join('\n')}
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
