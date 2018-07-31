import inquirer, { Question } from 'inquirer';
import chalk from 'chalk';

import { ICommandArgs } from '../util/interfaces';
import { getToken } from '../util';

const tokenCreateUrl = 'https://cloud.digitalocean.com/account/api/tokens/new';
const tokenCreateNotice = `${chalk.gray('Create your DigitalOcean API Token at')} ${chalk.green(tokenCreateUrl)}`;

export default async function configureCommand(args: ICommandArgs) {
	const { config } = args;

	console.log(tokenCreateNotice);

	const tokenQuestion: Question<{ token: string }> = {
		type: 'password',
		name: 'token',
		default: getToken(config),
		message: 'Please enter your DigitalOcean API token'
	};

	const { token } = await inquirer.prompt([tokenQuestion]);

	config.set('token', token);

	console.log(chalk.green('Successfully updated token!'));
}
