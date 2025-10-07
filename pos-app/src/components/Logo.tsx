
interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12', 
  lg: 'w-16 h-16',
  xl: 'w-20 h-20'
};

const svgSizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12', 
  xl: 'w-14 h-14'
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <div className={`${sizeClasses[size]} bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-orange-100 ${className}`}>
      <svg className={svgSizeClasses[size]} viewBox="0 0 100 100" fill="none">
        {/* Círculo de fondo naranja con apertura inferior */}
        <path d="M50 10 A40 40 0 0 1 50 90 A40 40 0 0 1 50 10 Z" fill="#f97316" />
        
        {/* Gráfico de barras - 4 barras como en la imagen */}
        <rect x="25" y="70" width="6" height="15" fill="#1e40af" rx="2" />
        <rect x="35" y="65" width="6" height="20" fill="#1e40af" rx="2" />
        <rect x="45" y="55" width="6" height="30" fill="#3b82f6" rx="2" />
        <rect x="55" y="50" width="6" height="35" fill="#3b82f6" rx="2" />
        
        {/* Flecha ascendente */}
        <path 
          d="M20 80 Q30 70 40 60 Q50 50 60 40 Q70 30 80 20" 
          stroke="#fb923c" 
          strokeWidth="3" 
          fill="none" 
          strokeLinecap="round"
        />
        <path 
          d="M75 25 L80 20 L75 15" 
          stroke="#fb923c" 
          strokeWidth="2.5" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

