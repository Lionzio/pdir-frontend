/**
 * Modelos de quartos derivados do contrato da API (T-35).
 *
 * Os tipos REST vêm de `core/api/schema.ts`, gerado do OpenAPI do backend (`npm run api:types`).
 * Se o backend mudar um campo, o `tsc` acusa aqui. Os eventos SSE não fazem parte do OpenAPI e
 * espelham `app/domain/hospitality/schemas.py` (Room*Event).
 */
import type { components } from '../../../core/api/schema';

type Schemas = components['schemas'];

export type RoomStatus = Schemas['RoomResponse']['status'];

/** Categoria aninhada no quarto (RoomCategoryResponse do domínio). */
export type RoomCategory = Schemas['RoomCategoryResponse'];

/** Item de GET /api/v1/rooms/categories. */
export type RoomCategoryOption = Schemas['RoomCategoryOption'];

/** Quarto como a API devolve: `capacity` e `category` podem ser nulos. */
export type Room = Schemas['RoomResponse'];

export type RoomCreateRequest = Schemas['RoomCreateRequest'];
export type RoomUpdateRequest = Schemas['RoomUpdateRequest'];

export interface RoomStatusChangedEvent {
  readonly event_type: 'room_status_changed';
  readonly room_id: number;
  readonly room_number: string;
  readonly new_status: RoomStatus;
  readonly previous_status: RoomStatus;
  readonly changed_by: string;
  readonly timestamp: string;
}

export interface RoomCreatedEvent {
  readonly event_type: 'room_created';
  readonly room_id: number;
  readonly room_number: string;
  readonly category_id: number;
  readonly floor: number;
  readonly created_by: string;
  readonly timestamp: string;
}

export interface RoomMetadataUpdatedEvent {
  readonly event_type: 'room_metadata_updated';
  readonly room_id: number;
  readonly previous_number: string;
  readonly new_number: string;
  readonly updated_by: string;
  readonly timestamp: string;
}

export type RoomEvent = RoomStatusChangedEvent | RoomCreatedEvent | RoomMetadataUpdatedEvent;
