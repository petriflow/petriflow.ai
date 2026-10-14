import fs from "node:fs";
import path from "node:path";
import {describe, expect, test} from "vitest";

const examplesPath = path.resolve("src/petriflow/snapshot/examples");

describe("snapshot example manifests", () => {
  test("lists every XML process with its matching process id and a description", () => {
    const directories = fs.readdirSync(examplesPath, {withFileTypes: true})
      .filter((entry) => entry.isDirectory());

    for (const directory of directories) {
      const directoryPath = path.join(examplesPath, directory.name);
      const xmlFiles = fs.readdirSync(directoryPath).filter((file) => file.endsWith(".xml"));
      const manifestPath = path.join(directoryPath, "manifest.json");

      expect(fs.existsSync(manifestPath), `${directory.name}/manifest.json`).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        processes: Array<{file: string; id: string; description: string}>;
      };

      expect(manifest.processes.map((process) => process.file).sort()).toEqual(xmlFiles.sort());
      for (const process of manifest.processes) {
        const xml = fs.readFileSync(path.join(directoryPath, process.file), "utf8");
        const processId = xml.match(/<document\b[\s\S]*?<id>([^<]+)<\/id>/)?.[1];

        expect(processId, process.file).toBe(process.id);
        expect(processId, process.file).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
        expect(process.description.trim().length, process.file).toBeGreaterThan(0);
      }
    }
  });

  test("uses lowercase snake_case for example folders and process filenames", () => {
    const snakeCase = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
    const directories = fs.readdirSync(examplesPath, {withFileTypes: true})
      .filter((entry) => entry.isDirectory());

    for (const directory of directories) {
      expect(directory.name).toMatch(snakeCase);
      for (const file of fs.readdirSync(path.join(examplesPath, directory.name))) {
        if (file.endsWith(".xml")) {
          expect(path.basename(file, ".xml")).toMatch(snakeCase);
        }
      }
    }
  });

  test("contains no Slovak diacritics in process XML", () => {
    const slovakDiacritics = /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/;
    const xmlFiles = fs.readdirSync(examplesPath, {withFileTypes: true})
      .filter((entry) => entry.isDirectory())
      .flatMap((directory) => {
        const directoryPath = path.join(examplesPath, directory.name);
        return fs.readdirSync(directoryPath)
          .filter((file) => file.endsWith(".xml"))
          .map((file) => path.join(directoryPath, file));
      });

    for (const file of xmlFiles) {
      expect(fs.readFileSync(file, "utf8"), path.relative(examplesPath, file)).not.toMatch(slovakDiacritics);
    }
  });

  test("contains no known Slovak identifiers or words in process XML", () => {
    const slovakTokens = /(^|[^a-z0-9])(adresa|obec|obce|okres|okresy|kraj|osoba|termin|vysetrenie|odberne|poistenec|poistenie|nehnutelnost|praca|komisia|veduceho|priezvisko|nazov|znamka|rodne|spravca|pridaj|vysledok|nahraj|podane|obhajoby|pripad|uloha|temy|tema|zmazat|upravit|zobrazit|import_obci|volna_kapacita|kapacita|kraje|miesto|miesta|terminy|prace|meno|zadanie|cislo|ulica|trvaly|pobyt|vyber|potvrdenie|zamietnutie|podanie|hodnotena|predsedu|predesedu|predseda|komisie|celkova|plocha|izieb|pocet|poschodie|pohlavie|spravit|importovane|konstruktor|bunky|std_ref_na|odberne_site)(?=$|[^a-z0-9])/i;
    const xmlFiles = fs.readdirSync(examplesPath, {withFileTypes: true})
      .filter((entry) => entry.isDirectory())
      .flatMap((directory) => {
        const directoryPath = path.join(examplesPath, directory.name);
        return fs.readdirSync(directoryPath)
          .filter((file) => file.endsWith(".xml"))
          .map((file) => path.join(directoryPath, file));
      });

    for (const file of xmlFiles) {
      expect(fs.readFileSync(file, "utf8"), path.relative(examplesPath, file)).not.toMatch(slovakTokens);
    }
  });
});
