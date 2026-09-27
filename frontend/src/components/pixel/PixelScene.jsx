import PixelTrain, { Track } from "./PixelTrain.jsx";
import { SPRITES } from "./sprites.js";
import { Sprite } from "./Sprite.jsx";

// Small decorative scenes for loading, empty and error states.
//   loading:  a train chugging on a scrolling track
//   station:  an empty station (nothing assigned yet)
//   farm:     a quiet farm (nothing created yet)
//   platform: an empty platform (no matches)
//   blocked:  a train stopped at a lowered crossing barrier (something went wrong)
export default function PixelScene({ variant = "loading", coach = false }) {
  return (
    <div className="px-scene" aria-hidden="true">
      <svg className="px-scene-art" viewBox="0 0 330 130" shapeRendering="crispEdges">
        {variant === "loading" && (
          <>
            <Sprite x={14} y={18} rects={SPRITES.pine()} />
            <Sprite x={276} y={24} rects={SPRITES.tree("#0b6e73")} />
          </>
        )}
        {variant === "station" && (
          <>
            <Sprite x={112} y={26} rects={SPRITES.station()} />
            <Sprite x={20} y={34} rects={SPRITES.pine()} />
            <Sprite x={270} y={38} rects={SPRITES.tree()} />
            <Sprite x={232} y={70} scale={4} rects={SPRITES.flowers()} />
          </>
        )}
        {variant === "farm" && (
          <>
            <Sprite x={0} y={96} rects={SPRITES.field(70, 4)} />
            <Sprite x={30} y={22} rects={SPRITES.barn()} />
            <Sprite x={130} y={36} rects={SPRITES.pine()} />
            <Sprite x={170} y={46} rects={SPRITES.pine("#129ea5")} />
            <Sprite x={250} y={30} rects={SPRITES.tree()} />
          </>
        )}
        {variant === "platform" && (
          <>
            <Sprite x={112} y={26} rects={SPRITES.station()} />
            <Sprite x={30} y={70} scale={4} rects={SPRITES.bush()} />
            <Sprite x={250} y={74} scale={4} rects={SPRITES.flowers()} />
          </>
        )}
        {variant === "blocked" && (
          <>
            <Sprite x={206} y={20} scale={3} rects={SPRITES.crossbuck()} />
            <Sprite x={120} y={62} scale={3} rects={SPRITES.barrier(10)} />
            <Sprite x={280} y={30} rects={SPRITES.pine()} />
          </>
        )}
      </svg>
      {variant !== "farm" && <Track scrolling={variant === "loading"} />}
      {variant === "loading" && (
        <div className="px-scene-train">
          <PixelTrain coach={coach} scale={2} />
        </div>
      )}
      {variant === "blocked" && (
        <div className="px-scene-train px-scene-train-left">
          <PixelTrain scale={1.5} moving={false} />
        </div>
      )}
    </div>
  );
}
