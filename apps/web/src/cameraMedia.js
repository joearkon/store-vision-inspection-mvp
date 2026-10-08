// These are fixed, synthetic demo covers—not live camera frames or AI evidence.
export const demoCameraImages = {
  front_counter: "/demo-cameras/front-counter.png",
  back_kitchen: "/demo-cameras/back-kitchen.jpg",
  dining_area: "/demo-cameras/dining-area.jpg",
  storage: "/demo-cameras/storage.jpg",
  pickup_area: "/demo-cameras/pickup-area.png"
};

export const cameraAreaNames = {
  front_counter: "前台操作区",
  back_kitchen: "后厨操作区",
  dining_area: "客人用餐区",
  storage: "仓储区",
  pickup_area: "取餐区"
};

export const dashboardCameraIds = [
  "CAM-FRONT-01", "CAM-BACK-01", "CAM-DINING-01", "CAM-PICKUP-01"
];

export function dashboardCameraSummary(cameras = []) {
  const byId = new Map(cameras.map((camera) => [camera.id, camera]));
  const real = ["CAM-MOMOYO-REAL-FRONT","CAM-MOMOYO-REAL-TABLE"].map(id=>byId.get(id)).filter(camera=>camera?.preview_image_url);
  const visible = [...real,...dashboardCameraIds.map((id) => byId.get(id)).filter(Boolean)].slice(0,4);
  return {
    visible,
    enabled: visible.filter((camera) => camera.status === "online").length,
    total: visible.length,
  };
}
