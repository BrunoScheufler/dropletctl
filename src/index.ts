#!/usr/bin/env node

import inquirer, { Question } from 'inquirer';
import ConfigStore from 'configstore';
import chalk from 'chalk';

import helpCommand from './commands/help.command';
import { ICommandArgs } from './util/interfaces';
import configureCommand from './commands/configure.command';
import spinupDropletCommand from './commands/spinup.command';

// tslint:disable-next-line
const packageInfo = require('../package.json');

const actions = ['💧 Spin up droplet', '🔧 Configure dropletctl', '🚨 Show help menu'];
const actionSelectionQuestion: Question<{ action: string }> = {
	type: 'list',
	name: 'action',
	message: chalk.green('What do you want to do?'),
	choices: actions
};

const handleError = (err: Error) => {
	console.error(chalk.red(err.message));

	if (process.env.NODE_ENV === 'development') {
		console.error(err);
	}

	process.exit(1);
};

(async () => {
	process.on('uncaughtException', handleError);
	process.on('unhandledRejection', handleError);

	const config = new ConfigStore(packageInfo.name);
	const { action } = await inquirer.prompt([actionSelectionQuestion]);

	const commandArgs: ICommandArgs = {
		config,
		packageInfo
	};

	switch (actions.indexOf(action)) {
		case 0:
			await spinupDropletCommand(commandArgs);
			break;
		case 1:
			await configureCommand(commandArgs);
			break;
		case 2:
		default:
			await helpCommand(commandArgs);
			break;
	}
})();
