export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export interface RoomCategory {
  readonly id: number;
  readonly name: string;
  readonly description?: string;
}

/** Item de GET /api/v1/rooms/categories (RoomCategoryResponse em rooms_controller.py). */
export interface RoomCategoryOption {
  readonly id: number;
  readonly name: string;
  readonly capacity: number;
  readonly base_rate: number;
}

export interface Room {
  readonly id: number;
  readonly number: string;
  readonly floor: number;
  readonly status: RoomStatus;
  readonly capacity: number;
  readonly category?: RoomCategory;
}

export interface RoomCreateRequest {
  number: string;
  floor: number;
  category_id: number;
  capacity: number;
}

export interface RoomUpdateRequest {
  number: string;
  floor: number;
  category_id: number;
  capacity: number;
}

export interface RoomStatusChangedEvent {
  readonly event_type: 'room_status_changed';
  readonly room_id: number;
  readonly new_status: RoomStatus;
  readonly previous_status: RoomStatus;
  readonly changed_by: string;
  readonly timestamp: string;
}
