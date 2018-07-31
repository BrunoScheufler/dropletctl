import { DigitalOcean } from 'dots-wrapper';
import inquirer, { Question } from 'inquirer';
import { hri } from 'human-readable-ids';

import { ICommandArgs } from '../util/interfaces';
import { getToken, spinPromise } from '../util';
import { IRegion, IImage, ISSHKey, ISnapshot } from 'dots-wrapper/dist/common/interfaces';
import chalk from 'chalk';

function prettifyImageName(i: IImage) {
	return `${i.distribution} ${i.name} ${i.slug ? chalk.gray(i.slug) : ''}`;
}

function prettifySSHKeyName(k: ISSHKey) {
	return `${k.name} ${chalk.gray(`#${k.id}`)}`;
}

function prettifySnapshotName(s: ISnapshot) {
	return `${s.name} ${chalk.gray(`#${s.id}`)}`;
}

async function loadRegions(digitalOcean: DigitalOcean) {
	const regions = (await spinPromise(digitalOcean.Region.list(1).toPromise(), {
		startText: 'Loading regions...',
		succeedText: 'Loaded regions!'
	})).items;
	return regions;
}

async function loadImages(digitalOcean: DigitalOcean) {
	const publicImages = (await spinPromise(digitalOcean.Image.list('snapshot', 1, 250).toPromise(), {
		startText: 'Loading public images...',
		succeedText: 'Loaded public images!'
	})).items;

	return publicImages;
}

async function loadSnapshots(digitalOcean: DigitalOcean) {
	const snapshots = (await spinPromise(digitalOcean.Snapshot.list(1, 250).toPromise(), {
		startText: 'Loading your snapshots...',
		succeedText: 'Loaded snapshots!'
	})).items;

	return snapshots;
}

async function loadKeys(digitalOcean: DigitalOcean) {
	const keys = (await spinPromise(digitalOcean.SSHKey.list(1, 250).toPromise(), {
		startText: 'Loading SSH Keys...',
		succeedText: 'Loaded SSH Keys!'
	})).items;

	return keys;
}

async function selectRegion(digitalOcean: DigitalOcean) {
	const availableRegions = await loadRegions(digitalOcean);

	const availableRegionNames = availableRegions
		.filter(r => r.available)
		.map(r => r.name)
		.sort((a, b) => a.localeCompare(b));

	const selectRegionQuestion: Question<{ region: string }> = {
		type: 'list',
		name: 'region',
		choices: availableRegionNames,
		message: 'Select a region for your droplet'
	};

	const { region } = await inquirer.prompt([selectRegionQuestion]);

	return availableRegions.find(r => r.name === region);
}

async function selectSpecs(region: IRegion, images: IImage[], keys: ISSHKey[], snapshots: ISnapshot[]) {
	const selectSizeQuestion = {
		type: 'list',
		choices: region.sizes.sort((a, b) => a.localeCompare(b)),
		message: 'Select a droplet size',
		name: 'size'
	};

	const prettifiedImageNames = images.map(image => prettifyImageName(image));
	const prettifiedSnapshotNames = snapshots.map(snapshot => prettifySnapshotName(snapshot));
	const selectImageQuestion = {
		type: 'list',
		choices: [...prettifiedSnapshotNames, ...prettifiedImageNames],
		name: 'image_snapshot',
		message: 'Select an image/snapshot'
	};

	const selectKeysQuestion = {
		type: 'checkbox',
		name: 'pretty_keys',
		choices: keys.map(key => prettifySSHKeyName(key)),
		message: 'Select your SSH keys to be added to the droplet'
	};

	const features = ['backups', 'ipv6', 'private_networking', 'monitoring'];
	const prettifiedFeatures = [
		`Automated backups ${chalk.gray('backup')}`,
		`IPv6 ${chalk.gray('ipv6')}`,
		`Private networking ${chalk.gray('private_networking')}`,
		`Monitoring ${chalk.gray('monitoring')}`
	];
	const selectFeaturesQuestion = {
		type: 'checkbox',
		name: 'features_raw',
		choices: prettifiedFeatures,
		message: 'Select additional droplet features'
	};

	const selectNameQuestion = {
		type: 'input',
		name: 'name',
		message: 'Choose a droplet name',
		default: hri.random()
	};

	interface ISpecs {
		// user input to be transformed into droplet details
		image_snapshot: string;
		pretty_keys: string[];
		features_raw: string[];

		// default droplet details
		size: string;
		image: string;
		name: string;
		ssh_keys: string[];

		// optional droplet features
		backups?: boolean;
		ipv6?: boolean;
		private_networking?: boolean;
		monitoring?: boolean;
	}

	const { pretty_keys, image_snapshot, features_raw, ...specs } = await inquirer.prompt<ISpecs>([
		selectSizeQuestion,
		selectImageQuestion,
		selectKeysQuestion,
		selectFeaturesQuestion,
		selectNameQuestion
	]);

	// find and return original image slug or snapshot id from selected prettified name
	specs.image = prettifiedSnapshotNames.includes(image_snapshot)
		? snapshots[prettifiedSnapshotNames.indexOf(image_snapshot)].id
		: images[prettifiedImageNames.indexOf(image_snapshot)].slug!;

	// find original keys based on their prettified name and return fingerprints
	specs.ssh_keys = pretty_keys.map(prettyKey => keys.find(k => prettifySSHKeyName(k) === prettyKey)!.fingerprint);

	// enable features
	features_raw.forEach(pFeatureName => {
		const featureName = features[prettifiedFeatures.indexOf(pFeatureName)];
		switch (featureName) {
			case 'backups':
				specs.backups = true;
				break;
			case 'ipv6':
				specs.ipv6 = true;
				break;
			case 'private_networking':
				specs.private_networking = true;
				break;
			case 'monitoring':
				specs.monitoring = true;
				break;
		}
	});

	return specs;
}

export default async function spinupDropletCommand(args: ICommandArgs) {
	const { config } = args;
	const token = getToken(config);

	if (typeof token !== 'string') {
		throw new Error('Please supply an API token either using the configuration or as an environment variable.');
	}

	const digitalOcean = new DigitalOcean(token);

	// Select droplet region
	const region = await selectRegion(digitalOcean);
	if (!region) {
		throw new Error('Please select a valid region!');
	}

	// retrieve and sort images
	const retrievedImages = await loadImages(digitalOcean);
	const images = retrievedImages.sort((a, b) => prettifyImageName(a).localeCompare(prettifyImageName(b)));

	// retrieve snapshots
	const retrievedSnapshots = await loadSnapshots(digitalOcean);
	const snapshots = retrievedSnapshots.filter(s => s.regions.includes(region.slug)).sort((a, b) => a.name.localeCompare(b.name));

	// Load keys
	const keys = await loadKeys(digitalOcean);

	// Select droplet specs
	const specs = await selectSpecs(region, images, keys, snapshots);

	// Create droplet
	const droplet = await digitalOcean.Droplet.create({ region: region.slug, ...specs }).toPromise();

	console.log(chalk.green('Congratulations! Your droplet was created successfully!'));
	console.log(`${chalk.gray('Droplet ID')} #${droplet.id}`);
	console.log(chalk.gray('Waiting for network details...'));

	// wait for droplet networks to be created to get the IP address (currently supports IPv4)
	const waitForDropletNetwork = setInterval(async () => {
		const dropletData = await digitalOcean.Droplet.get(droplet.id).toPromise();

		const { networks }: any = dropletData;
		const { v4, v6 } = networks;

		let hasv4 = false;
		const usev6 = specs.ipv6 === true;
		let hasv6 = false;

		if (networks && Array.isArray(v4) && v4.length > 0) {
			v4.forEach(netDetails => console.log(`${chalk.gray('IPv4 address')} ${netDetails.ip_address}`));
			hasv4 = true;
		}

		if (usev6 && networks && Array.isArray(v6) && v6.length > 0) {
			v6.forEach(netDetails => console.log(`${chalk.gray('IPv6 address')} ${netDetails.ip_address}`));
			hasv6 = true;
		}

		if (hasv4 && (!usev6 || (usev6 && hasv6))) {
			clearInterval(waitForDropletNetwork);
		}
	}, 15000);
}
