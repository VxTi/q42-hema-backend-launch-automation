macOS-only script for automatically launching the backend application.
This script authenticates the user with AWS, sets up everything and synchronizes with the
HEMA database.

Before using this script, you'll have to have `AWS SSO` setup. This can be done by doing the following steps:

```bash
aws configure sso --use-device-code
```

| Step                | Value                                    |
|---------------------|------------------------------------------|
| Start URL           | https://hema-digital.awsapps.com/start/# |
| Region              | eu-central-1                             |
| Output type         | json                                     | 
| Registration scopes | sso:account:access                       |
| AWS Account         | hema-preprod-experience-customerapp      |

After setting up `aws sso`, you can run this script by executing the following command:

```bash
npx tsx main.ts
```

Yes, very easy indeed.

Flags you can present with this script:

> `--aws-profile=<AWS PROFILE NAME>` - This flag forces the script to use this AWS SSO profile. If left blank, the
> script will automatically use the first profile it finds.

> `--skip-setup` - This flag forces the script to just authenticate with AWS, without building TS models.
> This makes the launching way faster, though a little more prone to errors.

> `--update` - This updates the git branch of the project.

> `--no-sync` - Prevent content sync. This can take up time, and is not always necessary.

> `--verbose` - Viewing all the logs that are spit out during setup. Usually not required.

> `--path=<PATH TO PROJECT>` - Set the path pointing to the project. If omitted, the script will attempt to find the directory starting from 
> root, meaning it'll take quite some time. If you want to speed up this process, either include `--path="..."` or manually update
> the `projectPath` variable in `main.ts`.

The most optimal way to run this script is