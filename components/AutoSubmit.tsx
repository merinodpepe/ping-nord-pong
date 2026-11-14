'use client';
import { useEffect, useRef } from 'react';

/** Envía el formulario que lo contiene nada más cargar. Las personas no tienen que pulsar nada;
 *  los escáneres de enlaces del correo no ejecutan JS, así que no gastan el token. */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    ref.current?.closest('form')?.requestSubmit();
  }, []);
  return <span ref={ref} hidden />;
}
