import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <button
      className={
        "px-4 py-2 rounded-xl font-semibold shadow-md focus:outline-none transition-transform duration-150 active:scale-95 bg-pink-500 text-white hover:bg-pink-600" +
        " " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
