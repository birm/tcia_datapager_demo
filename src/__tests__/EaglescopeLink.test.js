import { buildEaglescopeLink } from '../services/EaglescopeLink';

const MAP = {
  BASE_URL: 'https://pathdb.cancerimagingarchive.net/eaglescope/dist/',
  CONFIG_URL: '/system/files/collectionmetadata/202401/cohort_builder_01-27-2024.json',
  FIELDS: {
    collection: { id: 'collection', title: 'TCIA Collection', field: 'collection',
      values: { MiMM_SBILab: ['MiMM_SBILab'], 'CPTAC-LUAD': ['CPTAC-LUAD'] } },
    data_format: { id: 'data_format', title: 'Data Format', field: 'data_format',
      values: { BMP: ['BMP'] } },
    stain: { id: 'protocol', title: 'Staining Protocol', field: 'protocol',
      values: { 'H&E': ['Hematoxylin and Eosin', 'Hematoxylin and eosin'] } },
    has_genomics: { id: 'has_genomics', title: 'Has Genomics', field: 'has_genomics',
      values: { Yes: ['yes'], No: ['no'] } },
  },
};

const stateOf = (url) => JSON.parse(new URL(url).searchParams.get('filterState'));

describe('buildEaglescopeLink', () => {
  it('links to the base config with no filterState when unfiltered', () => {
    const { url, skipped } = buildEaglescopeLink([], MAP);
    expect(url).toBe(`${MAP.BASE_URL}?configurl=%2Fsystem%2Ffiles%2Fcollectionmetadata%2F202401%2Fcohort_builder_01-27-2024.json`);
    expect(skipped).toEqual([]);
  });

  it('matches the Eaglescope filterState shape for eq filters', () => {
    const { url } = buildEaglescopeLink([
      { id: 'c-collection', field: 'collection', operation: 'eq', values: 'MiMM_SBILab' },
      { id: 'f-data_format', field: 'data_format', operation: 'eq', values: 'BMP' },
    ], MAP);
    expect(stateOf(url)).toEqual([
      { id: 'collection', title: 'TCIA Collection', field: 'collection', operation: 'eq', values: 'MiMM_SBILab' },
      { id: 'data_format', title: 'Data Format', field: 'data_format', operation: 'eq', values: 'BMP' },
    ]);
    expect(url).not.toContain('+');
  });

  it('maps cleaned labels back to raw values, using `in` when several', () => {
    const { url } = buildEaglescopeLink([
      { id: 's', field: 'stain', operation: 'eq', values: 'H&E' },
      { id: 'g', field: 'has_genomics', operation: 'eq', values: 'Yes' },
    ], MAP);
    expect(stateOf(url)).toEqual([
      { id: 'protocol', title: 'Staining Protocol', field: 'protocol', operation: 'in',
        values: ['Hematoxylin and Eosin', 'Hematoxylin and eosin'] },
      { id: 'has_genomics', title: 'Has Genomics', field: 'has_genomics', operation: 'eq', values: 'yes' },
    ]);
  });

  it('intersects repeated filters on the same field', () => {
    const { url } = buildEaglescopeLink([
      { id: 'a', field: 'collection', operation: 'in', values: ['MiMM_SBILab', 'CPTAC-LUAD'] },
      { id: 'b', field: 'collection', operation: 'eq', values: 'CPTAC-LUAD' },
    ], MAP);
    expect(stateOf(url)).toHaveLength(1);
    expect(stateOf(url)[0].values).toBe('CPTAC-LUAD');
  });

  it('reports filters it cannot carry over', () => {
    const { url, skipped } = buildEaglescopeLink(
      [{ id: 'x', field: 'unknown', operation: 'eq', values: 'z' }],
      MAP,
      [{ field: 'unknown', label: 'Mystery' }]
    );
    expect(skipped).toEqual(['Mystery']);
    expect(new URL(url).searchParams.get('filterState')).toBeNull();
  });
});
