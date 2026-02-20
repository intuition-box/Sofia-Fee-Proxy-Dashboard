import './LoaderLoop.css';

interface LoaderLoopProps {
  size?: number;
}

const LoaderLoop = ({ size = 120 }: LoaderLoopProps) => {
  return (
    <div className="loader-loop-container">
      <svg
        className="loader-loop-svg"
        width={size}
        height={size}
        viewBox="0 0 698 696"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Path inférieur gauche */}
        <path
          className="outline-path path-1"
          d="M127.754 320.87V286.709C127.755 252.461 127.754 225.932 179.483 207.94L350.054 133L698 285.875V524.148L350.054 696L0 546.863V480.507L339.656 624.533C346.079 627.359 353.409 627.257 359.751 624.255L622.734 499.774C631.209 495.763 636.614 487.214 636.614 477.824V343.067C636.614 333.463 630.963 324.76 622.198 320.87L359.745 204.39C353.572 201.651 346.54 201.615 340.341 204.292L232.631 250.806C199.278 264.642 189.141 277.017 189.14 286.709V346.222L127.754 320.87Z"
        />
        {/* Path supérieur droit */}
        <path
          className="outline-path path-2"
          d="M570.246 375.13V409.291C570.245 443.539 570.246 470.068 518.517 488.06L347.946 563L6.19888e-06 410.125V171.852L347.946 0L698 149.137V215.493L358.344 71.4668C351.921 68.6409 344.591 68.7428 338.249 71.745L75.2657 196.226C66.7914 200.237 61.3862 208.786 61.3862 218.176V352.933C61.3864 362.537 67.0374 371.239 75.802 375.13L338.255 491.61C344.428 494.349 351.46 494.385 357.659 491.708L465.369 445.194C498.722 431.358 508.859 418.983 508.86 409.291V349.778L570.246 375.13Z"
        />

        {/* Groupe central */}
        <g className="center-group">
          {/* Losange central - face du haut */}
          <path
            className="center-diamond"
            d="M346.817 271.053C348.195 270.388 349.803 270.391 351.179 271.062L444.69 316.631C446.409 317.468 447.228 318.749 447.228 320.662L350.5 367C351.899 367.689 349.104 367.695 350.5 367L249.5 321.139C249.5 319.22 250.599 317.47 252.328 316.636L346.817 271.053Z"
            fill="#FFF8EE"
          />
          {/* Face droite */}
          <path
            className="center-face-right"
            d="M350.5 367L447.228 320.662V369.162L350.5 417.526V367Z"
            fill="#404040"
          />
          {/* Face gauche */}
          <path
            className="center-face-left"
            d="M350.5 367L249.5 321.139V369.707L350.5 417.526V367Z"
            fill="#B7B7B7"
          />
        </g>
      </svg>
    </div>
  );
};

export default LoaderLoop;
