import Lottie from 'lottie-react';
import catAnimation from '../../assets/black-rainbow-cat.json';

export default function FloatingCatLottie() {
  return (
    <div className="fixed right-2 sm:right-3 top-[100px] sm:top-[116px] z-40 pointer-events-none select-none opacity-95">
      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28">
        <Lottie
          animationData={catAnimation}
          loop
          autoplay
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
        />
      </div>
    </div>
  );
}
