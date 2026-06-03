"use client"

import defaultStyles from './search-input.module.css'
import { useState } from 'react';

interface SearchInputProps {
  placeholder: string;
  styles?: Record<string, string>
}


export default function SearchInput({ placeholder, styles=defaultStyles }: SearchInputProps) {
  const [text, setText] = useState<string>('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  }

  return (
    <div className={styles['input-group']}>
      <ion-icon name="search-outline"></ion-icon>
      <input type="text" placeholder={placeholder} value={text} onChange={handleChange} />
    </div>
  )
}