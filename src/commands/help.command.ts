import chalk from 'chalk';
import { ICommandArgs } from '../util/interfaces';

const helpText = (packageInfo: any) => `
  dropletctl ${chalk.green(`v${packageInfo.version}`)}

  ${chalk.gray('A convenient CLI tool to quickly spin up DigitalOcean droplets.')}

  ${chalk.blueBright(`https://github.com/BrunoScheufler/dropletctl`)}
`;

export default async function helpCommand(args: ICommandArgs) {
	console.log(helpText(args.packageInfo));
}
