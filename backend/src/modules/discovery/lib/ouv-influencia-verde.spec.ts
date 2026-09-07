import { Op } from 'sequelize';
import { InfluenciaEstado } from '../models/enums/ouv.enums';
import {
  isVerdeWithAssignedContact,
  verdeWithAssignedContactWhere,
} from './ouv-influencia-verde';

describe('isVerdeWithAssignedContact', () => {
  it('does not count Verde without a contact', () => {
    expect(
      isVerdeWithAssignedContact({
        estado: InfluenciaEstado.Verde,
        contactoOuvId: null,
      }),
    ).toBe(false);
  });

  it('counts Verde with an assigned contact', () => {
    expect(
      isVerdeWithAssignedContact({
        estado: InfluenciaEstado.Verde,
        contactoOuvId: 'contacto-1',
      }),
    ).toBe(true);
  });

  it('does not count other estados even with a contact', () => {
    expect(
      isVerdeWithAssignedContact({
        estado: InfluenciaEstado.Amarillo,
        contactoOuvId: 'contacto-1',
      }),
    ).toBe(false);
  });
});

describe('verdeWithAssignedContactWhere', () => {
  it('requires estado Verde and a non-null contacto', () => {
    expect(verdeWithAssignedContactWhere('ouv-1')).toEqual({
      ouvId: 'ouv-1',
      estado: InfluenciaEstado.Verde,
      contactoOuvId: { [Op.ne]: null },
    });
  });
});
