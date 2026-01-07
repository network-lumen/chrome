import { useState, useEffect } from 'react';

export interface Contact {
    id: string;
    name: string;
    address: string;
}

const STORAGE_KEY = 'lumen_contacts';

export function useContacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setContacts(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse contacts", e);
            }
        }
    }, []);

    const saveContacts = (newContacts: Contact[]) => {
        setContacts(newContacts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
    };

    const addContact = (name: string, address: string) => {
        const newContact: Contact = {
            id: Date.now().toString(),
            name,
            address
        };
        saveContacts([...contacts, newContact]);
    };

    const removeContact = (id: string) => {
        saveContacts(contacts.filter(c => c.id !== id));
    };

    const editContact = (id: string, name: string, address: string) => {
        saveContacts(contacts.map(c => c.id === id ? { ...c, name, address } : c));
    };

    return { contacts, addContact, removeContact, editContact };
}
