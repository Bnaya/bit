// @flow
import fs from 'fs-extra';
import path from 'path';
import { AbstractVinyl } from '../consumer/component/sources';
import { AUTO_GENERATED_STAMP, AUTO_GENERATED_MSG } from '../constants';
import type { PathOsBased } from '../utils/path';
import { BitId } from '../bit-id';
import logger from '../logger/logger';
import ValidationError from '../error/validation-error';

export default class LinkFile extends AbstractVinyl {
  override: ?boolean = false;
  writeAutoGeneratedMessage: ?boolean = true;
  srcPath: ?string; // existing path where the link is pointing to (needed for logging purposes)
  componentId: ?BitId; // needed for logging purposes

  async write(): Promise<string> {
    const stat = await this._getStatIfExists();
    if (stat) {
      if (stat.isSymbolicLink()) {
        throw new ValidationError(`fatal: trying to write a link file into a symlink file at "${this.path}"`);
      }
      if (!this.override) {
        const fileContent = fs.readFileSync(this.path).toString();
        if (!fileContent.includes(AUTO_GENERATED_STAMP)) return this.path;
      }
    }

    const data = this.writeAutoGeneratedMessage ? AUTO_GENERATED_MSG + this.contents : this.contents;
    try {
      await fs.outputFile(this.path, data);
    } catch (err) {
      if (err.code === 'EISDIR') {
        logger.debug(`deleting a directory ${this.path} in order to write a link file with the same name`);
        await fs.remove(this.path);
        await fs.outputFile(this.path, data);
      } else {
        throw err;
      }
    }

    return this.path;
  }

  async _getStatIfExists(): Promise<?fs.Stats> {
    try {
      return await fs.lstat(this.path);
    } catch (err) {
      return null; // probably file does not exist
    }
  }

  static load({
    filePath,
    base,
    content,
    override = false,
    writeAutoGeneratedMessage = true,
    srcPath,
    componentId
  }: {
    filePath: PathOsBased,
    base?: string,
    content: string,
    override?: boolean,
    writeAutoGeneratedMessage?: boolean,
    srcPath?: string,
    componentId?: BitId
  }): LinkFile {
    const linkFile = new LinkFile({
      base: base || path.dirname(filePath),
      path: filePath,
      contents: Buffer.from(content)
    });
    linkFile.override = override;
    linkFile.writeAutoGeneratedMessage = writeAutoGeneratedMessage;
    linkFile.srcPath = srcPath;
    linkFile.componentId = componentId;
    return linkFile;
  }
}
