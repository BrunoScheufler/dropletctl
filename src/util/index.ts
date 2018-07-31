import ConfigStore from 'configstore';
import ora from 'ora';

export function getToken(config: ConfigStore) {
	return process.env.DROPLETCTL_TOKEN || config.get('token');
}

export interface ISpinPromiseOptions {
	startText?: string;
	succeedText?: string;
}

export async function spinPromise<T>(p: Promise<T>, options: ISpinPromiseOptions): Promise<T> {
	const spinner = ora(options.startText);
	spinner.start();

	const result = await p;

	spinner.succeed(options.succeedText);

	return result;
}
