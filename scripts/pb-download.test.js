import { describe, expect, it } from 'vitest';
import { assetName } from './pb-download.js';

describe('assetName', () => {
	it('arma el nombre por plataforma', () => {
		expect(assetName('1.2.3', 'linux', 'x64')).toBe('pocketbase_1.2.3_linux_amd64.zip');
		expect(assetName('1.2.3', 'darwin', 'arm64')).toBe('pocketbase_1.2.3_darwin_arm64.zip');
		expect(assetName('1.2.3', 'win32', 'x64')).toBe('pocketbase_1.2.3_windows_amd64.zip');
	});
	it('rechaza plataformas desconocidas', () => {
		expect(() => assetName('1.2.3', 'sunos', 'x64')).toThrow(/no soportada/);
	});
});
