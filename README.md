macOS-only script for automatically launching the backend application.
This script authenticates the user with AWS, sets up everything and synchronizes with the
HEMA database.

Before anything, install the required NPM packages (only if you don't have tsx installed globally)
```bash
npm i
```

Very important.

Before using this script, you'll have to have `AWS SSO (Single Sign On)` setup. 
This can be done by running the following command, with the steps given below:

```bash
aws configure sso --use-device-code
```

Then you'll have to enter the following values for every step:

| Step                | Value                                    |
|---------------------|------------------------------------------|
| Start URL           | https://hema-digital.awsapps.com/start/# |
| Region              | eu-central-1                             |
| Output type         | json                                     | 
| Registration scopes | sso:account:access                       |
| AWS Account         | hema-preprod-experience-customerapp      |

After setting up `aws sso` successfully, you can run this script by executing the following command:

```bash
npx tsx main.ts <optional flags>
```

Yes, very easy indeed.

Flags you can present with this script:

> `--path=<PATH TO PROJECT>` - Set the path pointing to the project. If omitted, the script will attempt to find the directory starting from 
> root, meaning it'll take quite some time. If you want to speed up this process, either include `--path="..."` or manually update
> the `projectPath` variable in `main.ts`.

> `--aws-profile=<AWS PROFILE NAME>` - This flag forces the script to use this AWS SSO profile. If left blank, the
> script will automatically use the first profile it finds. This is especially useful if you've setup SSO for multiple AWS accounts,
> so the script won't accidentally select a different account. These configurations can be found in `~/.aws/config`

> `--skip-setup` - This flag forces the script to just authenticate with AWS, without building TS models and importing other stuff.
> This makes the launching way faster, though a little more prone to errors.

> `--update` - Pulls all new changes from the current git branch.

> `--no-sync` - Prevent content sync. This can take up time, and is not always necessary.
> So after syncing once, you can add this flag to make launching even speedier.

> `--verbose` - Viewing all the logs that are spit out during setup. Usually ignore-worthy