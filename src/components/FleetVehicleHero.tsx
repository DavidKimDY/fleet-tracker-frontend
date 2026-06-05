import vehicleImage from '../../docs/design/누끼 차량 이미지.png';

type Props = {
  active?: boolean;
};

export function FleetVehicleHero({ active = false }: Props) {
  return (
    <div
      className={`fleet-hero${active ? ' fleet-hero--active' : ''}`}
      aria-hidden
    >
      <div className="fleet-hero__ripples">
        <span className="fleet-hero__ring" />
        <span className="fleet-hero__ring" />
        <span className="fleet-hero__ring" />
        <span className="fleet-hero__ring" />
      </div>
      <img
        className="fleet-hero__vehicle"
        src={vehicleImage}
        alt=""
        draggable={false}
      />
    </div>
  );
}
