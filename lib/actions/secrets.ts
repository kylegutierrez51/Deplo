"use server"

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { FormState } from '@/lib/types';
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { auth } from '@/auth';


const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? (() => {
  throw new Error("ENCRYPTION_KEY is not set");
})();

function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encryptedValue = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encryptedValue, iv: iv.toString("hex"), authTag };
}

function decryptSecret(encryptedData: ReturnType<typeof encryptSecret>): string {
  const { encryptedValue, iv, authTag } = encryptedData;

  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// export async function addSecret(prevState: FormState, formData: FormData): Promise<FormState> {
//   const session = await auth();
//   const createdById = session?.user?.id ?? null;

//   const key = formData.get('name') as string;
//   const value = formData.get('value') as string;
//   const environmentName = formData.get('env_name') as string;
//   const notes = formData.get('notes') as string;


//   try {
//     await prisma.secret.create({
//       data: { key, value, notes, createdById },
//     });

//     revalidatePath('/secrets');

//     return { 
//       status: 'success', 
//       message: 'Secret added'
//     };

//   } catch (error: unknown) {
//     console.log(error instanceof Error ? error.message : '');
//     return {
//       status: 'error',
//       message: 'Error adding secret. Please try again.',
//     };
//   }
// }

// export async function updateSecret(prevState: FormState, formData: FormData): Promise<FormState> {
//   const id = formData.get('id') as string;
//   const name = formData.get('name') as string;
//   const repoUrl = formData.get('repo_url') as string;
//   const description = formData.get('description') as string;
//   const branchFilters = formData.getAll('branch_filters') as string[];

//   try {
//     await prisma.secret.update({
//       where: { id },
//       data: { name, repoUrl, description, branchFilters },
//     });

//     revalidatePath('/secrets');

//     return { 
//       status: 'success', 
//       message: 'Secret updated' 
//     };

//   } catch (error: unknown) {
//     console.log(error instanceof Error ? error.message : '');
//     return {
//       status: 'error',
//       message: error instanceof Error ? error.message : 'Error updating secret. Please try again.',
//     };
//   }
// }

export async function deleteSecret(id: string): Promise<FormState> {
  try {
    const deletedSecret = await prisma.secret.delete({
      where: { id }
    });

    revalidatePath('/secrets');

    return {
      status: 'success',
      message: `Secret ${deletedSecret.id} deleted`
    }

  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
      console.log(`${error.code}:` + 'Error deleting secret');
    }
    console.log(error instanceof Error ? error.message : '');
    return {
      status: 'error',
      message: 'Error deleting secret. Please try again.'
    }
  }
}