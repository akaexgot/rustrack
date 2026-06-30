export type RustMapMonument = {
  type: string;
  sizeCategory: string;
  x: number;
  y: number;
};

export type RustMapInfo = {
  id: string;
  type: string;
  seed: number;
  size: number;
  imageUrl: string;
  thumbnailUrl: string;
  url: string;
  landPercentageOfMap?: number;
  biomePercentages?: Record<string, number>;
  totalMonuments?: number;
  largeMonuments?: number;
  smallMonuments?: number;
  safezones?: number;
  caves?: number;
  monuments: RustMapMonument[];
};
