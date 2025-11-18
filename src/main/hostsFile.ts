import { app } from 'electron';
import path from "path";
import fs from "fs";
import os from "os";
import sudo from 'sudo-prompt';
import { execSync } from 'child_process';

const configJsonFileName = 'config.json';
const startConfigJsonString = '### WORK LIFE START ###';
const endConfigJsonString = '### WORK LIFE END ###';
const invalidHost = '127.0.0.1';
const platform = os.platform(); // OS system 
const DNS_FLUSH_COMMANDS = {
    win32: 'ipconfig /flushdns',
    darwin: 'dscacheutil -flushcache && killall -HUP mDNSResponder',
    linux: 'systemd-resolve --flush-caches'
};
type SupportedPlatform = keyof typeof DNS_FLUSH_COMMANDS;


interface ConfigFileData {
    filePath: string;
    fileContent: ConfigFileContent;
}

interface ConfigFileContent {
    blockedDomains: string[]
}

export const getConfigJsonData = (): ConfigFileData => {
    const filePath = path.join(app.getPath('userData'), configJsonFileName);
    const newConfigData: ConfigFileContent = {
        "blockedDomains": []
    };
    let fileContent = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : newConfigData;
    return { filePath, fileContent }
}

export function getHostsFilePath(): string {
    if (platform === 'win32') {
        // Windows uses "\....\System32\drivers\etc\hosts"
        return path.join(
            process.env.SystemRoot || 'C:\\Windows',
            'System32',
            'drivers',
            'etc',
            'hosts',
        );
    } else {
        // darwin = macOS, linux and most *nix use /etc/hosts
        return '/etc/hosts';
    }
}

export const getHostsFileContent = () => {
    return fs.readFileSync(getHostsFilePath(), 'utf-8');
}

const generateBlockedDomainString = (blockedDomains: string[]) => {
    let returnedString = '';
    for (const blockedDomain of blockedDomains) {
        returnedString += `\n${invalidHost} ${blockedDomain}`; // Add a redirect to an invalid host - basically blocking the url
    }
    returnedString = `\n${startConfigJsonString}${returnedString}\n${endConfigJsonString}\n`;
    return returnedString;
}

export const setHostsFileContent = () => {
    // Throw error immediately if platform is unsupported
    if (!(platform in DNS_FLUSH_COMMANDS)) {
        throw new Error(`Unsupported platform: ${process.platform}`);
    }

    // Set + get initial variables needed
    const hostsFilePath = getHostsFilePath();
    const hostsFileContent = getHostsFileContent();
    const configJsonData = getConfigJsonData();
    const blockedDomainString = generateBlockedDomainString(configJsonData.fileContent.blockedDomains);
    const beforeConfigJson = hostsFileContent.split(startConfigJsonString)[0];
    const afterConfigJson: string | undefined = hostsFileContent.split(endConfigJsonString)[1];
    const finalHostsFileContent = `${beforeConfigJson}${blockedDomainString}${afterConfigJson ? afterConfigJson : ""}`;

    // Try direct write first (works if running as root/sudo) - dev path
    const isSuccess = writeHostsFileAndFlushCache_Dev(hostsFilePath, finalHostsFileContent);
    if (isSuccess) {
        return;
    }

    // Production path - need permissions via sudo-prompt
    writeHostsFileAndFlushCache_Prod(hostsFilePath, finalHostsFileContent);
}

const writeHostsFileAndFlushCache_Dev = (hostsFilePath: string, finalHostsFileContent: string) => {
    try {
        fs.writeFileSync(hostsFilePath, finalHostsFileContent);
        console.log('Hosts file updated successfully (direct write)');

        // Also flush DNS directly (we're already elevated)
        const flushCommand = DNS_FLUSH_COMMANDS[platform as SupportedPlatform];
        try {
            execSync(flushCommand);
            console.log('DNS cache flushed');
        } catch (flushError) {
            console.warn('DNS flush failed (non-critical):', flushError);
        }

        return true; // Success - exit early
    } catch (error) {
        // Permission denied - need elevation
        console.log('Direct write failed, try to run with sudo. Attempting now with elevation...', error);
    }
}

const writeHostsFileAndFlushCache_Prod = (hostsFilePath: string, finalHostsFileContent: string) => {
    // Write to temp file first
    const tempPath = platform === 'win32'
        ? path.join(process.env.TEMP || 'C:\\temp', 'hosts-temp')
        : '/tmp/hosts-temp';

    fs.writeFileSync(tempPath, finalHostsFileContent);

    // Platform-specific commands
    const copyCommand = platform === 'win32'
        ? `copy /Y "${tempPath}" "${hostsFilePath}"`
        : `cp ${tempPath} ${hostsFilePath}`;
    const flushCommand = DNS_FLUSH_COMMANDS[platform as SupportedPlatform];
    const combinedCommand = `${copyCommand} && ${flushCommand}`;

    // Execute with admin permissions
    const options = {
        name: 'Work Life'
    };

    // Execute overwrite of hosts file, then try to flush cache
    sudo.exec(combinedCommand, options, (error, stdout, stderr) => {
        if (error) {
            console.error('Failed to update hosts file:', error);
            return;
        }
        console.log('Hosts file updated and DNS cache flushed successfully');

        // Clean up temp file
        try {
            fs.unlinkSync(tempPath);
        } catch (cleanupError) {
            console.warn('Failed to clean up temp file:', cleanupError);
        }
    });
}